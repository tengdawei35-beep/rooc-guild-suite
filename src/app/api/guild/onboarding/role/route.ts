import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const JOURNEYS = {
  OFFICER: [
    { id: "members", title: "Get familiar with the guild directory", description: "Find member profiles, review character details and understand where availability is managed.", href: "/guild/members", action: "Open member directory" },
    { id: "events", title: "Learn the event workflow", description: "Review upcoming events, event details and attendance responses.", href: "/events", action: "Explore events" },
    { id: "rosters", title: "Review roster management", description: "See how preferred rosters and event rosters are organised.", href: "/events?view=rosters", action: "View rosters" },
    { id: "availability", title: "Check leave and availability", description: "Review member availability so event and roster planning reflects who can participate.", href: "/guild/members/leave/history", action: "Review availability" },
    { id: "recruitment", title: "Understand recruitment", description: "Review incoming applications and the recruitment workflow.", href: "/guild/applicants", action: "Open recruitment" },
  ],
  MEMBER: [
    { id: "profile", title: "Find your character profile", description: "Check that your character is linked to your account and review your profile details.", href: "/guild/members", action: "Find my profile" },
    { id: "events", title: "Stay on top of guild events", description: "Browse upcoming events, open an event and submit your attendance response when requested.", href: "/events", action: "View upcoming events" },
    { id: "directory", title: "Meet your guild", description: "Browse the guild directory and get familiar with your fellow members.", href: "/guild/members", action: "Browse members" },
    { id: "availability", title: "Set your availability", description: "Submit leave dates when you know you cannot participate in guild activities.", href: "/guild/members/leave", action: "Manage availability" },
    { id: "stats", title: "Keep your character information current", description: "Review your character profile and check with guild management if your details or stats need updating.", href: "/guild/members", action: "Review my details" },
  ],
} as const;

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (auth.originalRole !== "OFFICER" && auth.originalRole !== "MEMBER") {
    return NextResponse.json({ error: "This onboarding guide is for officers and members." }, { status: 403 });
  }

  const progress = await prisma.guildRoleOnboardingProgress.findUnique({
    where: { userId_guildId: { userId: auth.user.id, guildId: auth.guild.id } },
    select: { completedStepIds: true, dismissedAt: true },
  });
  const completedIds = new Set(progress?.completedStepIds ?? []);
  const tasks = JOURNEYS[auth.originalRole].map((task) => ({ ...task, complete: completedIds.has(task.id) }));
  return NextResponse.json({
    role: auth.originalRole,
    readOnly: !auth.subscriptionActive,
    title: auth.originalRole === "OFFICER" ? "Your officer journey" : "Your member journey",
    description: auth.originalRole === "OFFICER"
      ? "A practical introduction to the tools you will use to support guild operations."
      : "A quick guide to the features that help you stay connected with your guild.",
    tasks,
    completed: tasks.filter((task) => task.complete).length,
    total: tasks.length,
    dismissed: Boolean(progress?.dismissedAt),
  });
}

export async function PATCH(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!auth.subscriptionActive) return NextResponse.json({ error: "This guild is read-only until its subscription is renewed." }, { status: 403 });
  if (auth.originalRole !== "OFFICER" && auth.originalRole !== "MEMBER") {
    return NextResponse.json({ error: "This onboarding guide is for officers and members." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as {
    completedStepIds?: unknown;
    dismissed?: unknown;
    reset?: unknown;
  };
  const allowedIds = new Set(JOURNEYS[auth.originalRole].map((task) => task.id));

  if (body.reset === true) {
    await prisma.guildRoleOnboardingProgress.upsert({
      where: { userId_guildId: { userId: auth.user.id, guildId: auth.guild.id } },
      create: { id: randomUUID(), userId: auth.user.id, guildId: auth.guild.id, completedStepIds: [] },
      update: { completedStepIds: [], dismissedAt: null },
    });
    return NextResponse.json({ success: true, reset: true });
  }

  if (body.dismissed === true || body.dismissed === false) {
    await prisma.guildRoleOnboardingProgress.upsert({
      where: { userId_guildId: { userId: auth.user.id, guildId: auth.guild.id } },
      create: { id: randomUUID(), userId: auth.user.id, guildId: auth.guild.id, dismissedAt: body.dismissed ? new Date() : null },
      update: { dismissedAt: body.dismissed ? new Date() : null },
    });
    return NextResponse.json({ success: true });
  }

  if (!Array.isArray(body.completedStepIds) || !body.completedStepIds.every((id) => typeof id === "string" && allowedIds.has(id as never))) {
    return NextResponse.json({ error: "Invalid onboarding progress." }, { status: 400 });
  }

  await prisma.guildRoleOnboardingProgress.upsert({
    where: { userId_guildId: { userId: auth.user.id, guildId: auth.guild.id } },
    create: { id: randomUUID(), userId: auth.user.id, guildId: auth.guild.id, completedStepIds: body.completedStepIds as string[] },
    update: { completedStepIds: body.completedStepIds as string[] },
  });
  return NextResponse.json({ success: true });
}
