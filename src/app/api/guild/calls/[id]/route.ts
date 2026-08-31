import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { announceFilledCall, ensureCallTables, newId, refreshCallStatus, requirementMatchesJob } from "@/lib/call-to-arms";

async function getCall(id: string, guildId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT c.id, c.title, c.description, c.start_at AS "startAt", c.status, c.creator_user_id AS "creatorUserId", u.username AS "creatorUsername", COALESCE((SELECT SUM(quantity)::integer FROM "guild_call_requirements" WHERE call_id = c.id),0)::integer AS "requiredCount", COALESCE((SELECT COUNT(*)::integer FROM "guild_call_participants" WHERE call_id = c.id AND status = 'ACTIVE'),0)::integer AS "activeCount" FROM "guild_calls" c JOIN "User" u ON u.id = c.creator_user_id WHERE c.id = $1 AND c.guild_id = $2`, id, guildId);
  return rows[0] ?? null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view this call." }, { status: 403 });
  try {
    await ensureCallTables();
    const { id } = await params;
    const call = await getCall(id, auth.guild.id);
    if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });
    const requirements = await prisma.$queryRawUnsafe<any[]>(`SELECT id, requirement, quantity FROM "guild_call_requirements" WHERE call_id = $1 ORDER BY created_at`, id);
    const participants = await prisma.$queryRawUnsafe<any[]>(`SELECT p.id, p.requirement_id AS "requirementId", p.status, p.signed_up_at AS "signedUpAt", p.member_id AS "memberId", m.character_name AS "characterName", m.discord_username AS "discordUsername", m.discord_user_id AS "discordUserId", m.job FROM "guild_call_participants" p JOIN "GuildMember" m ON m.id = p.member_id WHERE p.call_id = $1 ORDER BY p.signed_up_at`, id);
    const currentMember = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, userId: auth.user.id, active: true }, select: { id: true } });
    const webhook = await prisma.$queryRawUnsafe<Array<{ webhook_url: string }>>(`SELECT webhook_url FROM "guild_call_webhooks" WHERE guild_id = $1`, auth.guild.id);
    const canManage = call.creatorUserId === auth.user.id || ["ADMIN", "MANAGER", "OFFICER"].includes(auth.role);
    return NextResponse.json({ call, requirements, participants, signedUp: participants.some((p) => p.memberId === currentMember?.id), webhookConfigured: Boolean(webhook[0]), canManage });
  } catch (error) {
    console.error("[CALL TO ARMS] detail failed", error);
    return NextResponse.json({ error: "Failed to load Call To Arms. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to use calls." }, { status: 403 });
  try {
    await ensureCallTables();
    const { id } = await params;
    const call = await getCall(id, auth.guild.id);
    if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });
    const body = await request.json();
    const action = body.action;
    const member = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, userId: auth.user.id, active: true }, select: { id: true, job: true, characterName: true, discordUsername: true, discordUserId: true } });
    if (!member) return NextResponse.json({ error: "You need an active guild member profile to sign up." }, { status: 400 });
    if (action === "signup") {
      if (["CANCELLED", "COMPLETED"].includes(call.status)) return NextResponse.json({ error: "This call is no longer open." }, { status: 400 });
      const requirementId = String(body.requirementId ?? "");
      const reqRows = await prisma.$queryRawUnsafe<Array<{ id: string; requirement: string; quantity: number }>>(`SELECT id, requirement, quantity FROM "guild_call_requirements" WHERE id = $1 AND call_id = $2`, requirementId, id);
      const requirement = reqRows[0];
      if (!requirement || !requirementMatchesJob(requirement.requirement, member.job)) return NextResponse.json({ error: "Your current job does not qualify for that slot." }, { status: 400 });
      if ((await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM "guild_call_participants" WHERE call_id = $1 AND member_id = $2`, id, member.id)).length) return NextResponse.json({ error: "You are already signed up for this call." }, { status: 409 });
      const activeCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) FROM "guild_call_participants" WHERE call_id = $1 AND requirement_id = $2 AND status = 'ACTIVE'`, id, requirementId);
      const status = Number(activeCount[0]?.count ?? 0) < requirement.quantity ? "ACTIVE" : "WAITLIST";
      await prisma.$executeRawUnsafe(`INSERT INTO "guild_call_participants" (id, call_id, requirement_id, member_id, status) VALUES ($1,$2,$3,$4,$5)`, newId("participant"), id, requirementId, member.id, status);
      const next = await refreshCallStatus(id);
      if (next === "FILLED") { try { await announceFilledCall(id); } catch (error) { console.error("[CALL TO ARMS] announcement failed", error); } }
      return NextResponse.json({ status, notificationAttempted: next === "FILLED" });
    }
    if (action === "leave") {
      await prisma.$executeRawUnsafe(`DELETE FROM "guild_call_participants" WHERE call_id = $1 AND member_id = $2`, id, member.id);
      const reqs = await prisma.$queryRawUnsafe<any[]>(`SELECT id, quantity FROM "guild_call_requirements" WHERE call_id = $1`, id);
      for (const req of reqs) {
        const active = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) FROM "guild_call_participants" WHERE call_id = $1 AND requirement_id = $2 AND status = 'ACTIVE'`, id, req.id);
        const slots = Math.max(0, Number(req.quantity) - Number(active[0]?.count ?? 0));
        if (slots > 0) {
          const waiters = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "guild_call_participants" WHERE call_id = $1 AND requirement_id = $2 AND status = 'WAITLIST' ORDER BY signed_up_at LIMIT $3`, id, req.id, slots);
          for (const waiter of waiters) await prisma.$executeRawUnsafe(`UPDATE "guild_call_participants" SET status = 'ACTIVE', updated_at = now() WHERE id = $1`, waiter.id);
        }
      }
      await refreshCallStatus(id);
      return NextResponse.json({ ok: true });
    }
    if (action === "cancel" || action === "confirm") {
      if (call.creatorUserId !== auth.user.id && !["ADMIN", "MANAGER", "OFFICER"].includes(auth.role)) return NextResponse.json({ error: "Only the creator or guild managers can do this." }, { status: 403 });
      const status = action === "cancel" ? "CANCELLED" : "CONFIRMED";
      await prisma.$executeRawUnsafe(`UPDATE "guild_calls" SET status = $2, updated_at = now() WHERE id = $1`, id, status);
      return NextResponse.json({ ok: true, status });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("[CALL TO ARMS] action failed", error);
    return NextResponse.json({ error: "Call To Arms action failed. Please try again." }, { status: 500 });
  }
}