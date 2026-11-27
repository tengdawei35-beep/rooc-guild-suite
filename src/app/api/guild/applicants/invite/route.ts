import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function forbidden() {
  return NextResponse.json({ error: "You do not have permission to manage guild applicants." }, { status: 403 });
}

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.originalRole, "applicants.view")) return forbidden();

  const invites = await prisma.applicantInvite.findMany({
    where: { guildId: auth.guild.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}

export async function POST() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "applicants.manage")) return forbidden();

  try {
    // Serializable isolation prevents concurrent requests from both observing
    // "no active invite" and creating separate active links for the same guild.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.applicantInvite.findFirst({
        where: { guildId: auth.guild.id, active: true },
        orderBy: { createdAt: "desc" },
      });

      if (existing) return { invite: existing, reused: true };

      const invite = await tx.applicantInvite.create({
        data: {
          guildId: auth.guild.id,
          token: randomBytes(32).toString("base64url"),
          createdByUserId: auth.user.id,
        },
      });
      return { invite, reused: false };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2034") {
      // A concurrent invite request won the serializable transaction race.
      const existing = await prisma.applicantInvite.findFirst({
        where: { guildId: auth.guild.id, active: true },
        orderBy: { createdAt: "desc" },
      });
      if (existing) return NextResponse.json({ invite: existing, reused: true });
    }
    console.error("[APPLICANTS] Invite creation failed:", error);
    return NextResponse.json({ error: "Failed to create an application link. Please try again." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "applicants.manage")) return forbidden();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Invite ID is required." }, { status: 400 });

  const invite = await prisma.applicantInvite.findFirst({ where: { id, guildId: auth.guild.id } });
  if (!invite) return NextResponse.json({ error: "Invite not found." }, { status: 404 });

  await prisma.applicantInvite.update({
    where: { id: invite.id },
    data: { active: false, revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
