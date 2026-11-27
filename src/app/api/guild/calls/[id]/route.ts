import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jobsForGame } from "@/lib/constants/jobs";
import { announceConfirmedCall, announceFilledCall, ensureCallTables, isValidCallRequirement, newId, refreshCallStatus, requirementMatchesJob } from "@/lib/call-to-arms";

type CallRequirement = { id: string; requirement: string; quantity: number };
type ActiveParticipant = { requirement_id: string; job: string | null };

async function getCall(id: string, guildId: string) { const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT c.id, c.title, c.description, c.start_at AS "startAt", c.status, c.creator_user_id AS "creatorUserId", u.username AS "creatorUsername", COALESCE((SELECT SUM(quantity)::integer FROM "guild_call_requirements" WHERE call_id = c.id),0)::integer AS "requiredCount", COALESCE((SELECT COUNT(*)::integer FROM "guild_call_participants" WHERE call_id = c.id AND status = 'ACTIVE'),0)::integer AS "activeCount" FROM "guild_calls" c JOIN "User" u ON u.id = c.creator_user_id WHERE c.id = $1 AND c.guild_id = $2`, id, guildId); return rows[0] ?? null; }
function canManage(call:any, auth:any){return auth.subscriptionActive && (call.creatorUserId===auth.user.id||["ADMIN","MANAGER","OFFICER"].includes(auth.role))}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await getCurrentAuth(); if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view this call." }, { status: 403 }); try { await ensureCallTables(); const { id } = await params; const call = await getCall(id, auth.guild.id); if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 }); const requirements = await prisma.$queryRawUnsafe<CallRequirement[]>(`SELECT id, requirement, quantity FROM "guild_call_requirements" WHERE call_id = $1 ORDER BY created_at`, id); const participants = await prisma.$queryRawUnsafe<any[]>(`SELECT p.id, p.requirement_id AS "requirementId", p.status, p.signed_up_at AS "signedUpAt", p.member_id AS "memberId", p.job, m."characterName" AS "characterName", m."discordUsername" AS "discordUsername", m."discordUserId" AS "discordUserId" FROM "guild_call_participants" p JOIN "GuildMember" m ON m.id = p.member_id WHERE p.call_id = $1 ORDER BY p.signed_up_at`, id); const currentMember = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, active: true, OR: [{ userId: auth.user.id }, ...(auth.user.discordId ? [{ discordUserId: auth.user.discordId }] : [])] }, select: { id: true } }); const webhook = await prisma.$queryRawUnsafe<Array<{ webhook_url: string }>>(`SELECT webhook_url FROM "guild_call_webhooks" WHERE guild_id = $1`, auth.guild.id); const manager = canManage(call,auth); const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } }); return NextResponse.json({ gameType: guild?.gameType === "RO3" ? "RO3" : "ROOC", call, requirements, participants, signedUp: participants.some((p) => p.memberId === currentMember?.id), webhookConfigured: Boolean(webhook[0]), canManage: manager }); } catch (error) { console.error("[CALL TO ARMS] detail failed", error); return NextResponse.json({ error: "Failed to load Call To Arms. Please try again." }, { status: 500 }); } }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await getCurrentAuth(); if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to use calls." }, { status: 403 }); if (!auth.subscriptionActive) return NextResponse.json({ error: "This guild is read-only until its subscription is renewed." }, { status: 403 }); try { await ensureCallTables(); const { id } = await params; const call = await getCall(id, auth.guild.id); if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 }); const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } }); const gameType = guild?.gameType === "RO3" ? "RO3" : "ROOC"; const body = await request.json(); const action = body.action;
if (action === "edit") {
  if (!canManage(call, auth)) {
    return NextResponse.json({ error: "Only the creator or guild managers can edit this call." }, { status: 403 });
  }

  const title = String(body.title ?? "").trim();
  const description = body.description == null ? null : String(body.description);
  const startAt = String(body.startAt ?? "");
  const requirements = Array.isArray(body.requirements) ? body.requirements : [];
  if (!title || !startAt || !requirements.length) {
    return NextResponse.json({ error: "Name, time and at least one job requirement are required." }, { status: 400 });
  }

  const parsedDate = new Date(startAt);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
    return NextResponse.json({ error: "Call time must be a valid future date." }, { status: 400 });
  }

  const clean = requirements.map((r: any): CallRequirement => ({
    id: String(r.id || ""),
    requirement: String(r.requirement || "").trim(),
    quantity: Number(r.quantity),
  }));
  if (
    clean.some((r: CallRequirement) =>
      !r.requirement ||
      !isValidCallRequirement(r.requirement, gameType) ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 1 ||
      r.quantity > 50
    ) ||
    new Set(clean.map((r: CallRequirement) => r.id).filter(Boolean)).size !== clean.filter((r: CallRequirement) => r.id).length
  ) {
    return NextResponse.json({
      error: "Each requirement must use a valid job or role, have 1–50 slots, and appear only once.",
    }, { status: 400 });
  }

  const editResult = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM "guild_calls"
       WHERE id = $1 AND guild_id = $2
       FOR UPDATE`,
      id,
      auth.guild.id
    );
    if (!locked.length) return { error: "Call not found.", statusCode: 404 as const };
    if (["CANCELLED", "COMPLETED"].includes(locked[0].status)) {
      return { error: "This call can no longer be edited.", statusCode: 400 as const };
    }

    const existing = await tx.$queryRawUnsafe<CallRequirement[]>(
      `SELECT id, requirement, quantity
       FROM "guild_call_requirements"
       WHERE call_id = $1
       ORDER BY created_at`,
      id
    );
    const participants = await tx.$queryRawUnsafe<Array<{
      requirement_id: string;
      job: string | null;
      status: string;
    }>>(
      `SELECT requirement_id, job, status
       FROM "guild_call_participants"
       WHERE call_id = $1`,
      id
    );

    for (const participant of participants) {
      const next = clean.find((r: CallRequirement) => r.id === participant.requirement_id);
      if (!next || !requirementMatchesJob(next.requirement, participant.job, gameType)) {
        return {
          error: "Cannot change or remove a requirement while participants are assigned to it. Ask them to leave first.",
          statusCode: 400 as const,
        };
      }
    }

    for (const requirement of existing) {
      const activeCount = participants.filter(
        (p) => p.requirement_id === requirement.id && p.status === "ACTIVE"
      ).length;
      const next = clean.find((r: CallRequirement) => r.id === requirement.id);
      if (next && next.quantity < activeCount) {
        return {
          error: "A requirement cannot be reduced below its current number of active participants.",
          statusCode: 400 as const,
        };
      }
    }

    await tx.$executeRawUnsafe(
      `UPDATE "guild_calls"
       SET title = $2, description = $3, start_at = $4,
           status = 'OPEN', announced_at = NULL, reminder_sent_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      id,
      title,
      description,
      parsedDate
    );

    const keepIds = new Set(clean.map((r: CallRequirement) => r.id).filter(Boolean));
    for (const requirement of existing) {
      if (!keepIds.has(requirement.id)) {
        await tx.$executeRawUnsafe(
          `DELETE FROM "guild_call_requirements" WHERE id = $1 AND call_id = $2`,
          requirement.id,
          id
        );
      }
    }

    for (const requirement of clean) {
      if (requirement.id && existing.some((r) => r.id === requirement.id)) {
        await tx.$executeRawUnsafe(
          `UPDATE "guild_call_requirements"
           SET requirement = $2, quantity = $3
           WHERE id = $1 AND call_id = $4`,
          requirement.id,
          requirement.requirement,
          requirement.quantity,
          id
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO "guild_call_requirements" (id, call_id, requirement, quantity)
           VALUES ($1, $2, $3, $4)`,
          newId("requirement"),
          id,
          requirement.requirement,
          requirement.quantity
        );
      }
    }

    const totals = await tx.$queryRawUnsafe<Array<{ required: bigint; active: bigint }>>(
      `SELECT
         COALESCE((SELECT SUM(quantity) FROM "guild_call_requirements" WHERE call_id = $1), 0) AS required,
         COALESCE((SELECT COUNT(*) FROM "guild_call_participants" WHERE call_id = $1 AND status = 'ACTIVE'), 0) AS active`,
      id
    );
    const nextStatus = Number(totals[0]?.active ?? 0) >= Number(totals[0]?.required ?? 0)
      ? "FILLED"
      : "OPEN";
    await tx.$executeRawUnsafe(
      `UPDATE "guild_calls" SET status = $2, updated_at = now() WHERE id = $1`,
      id,
      nextStatus
    );
    return { ok: true };
  }, { isolationLevel: "Serializable" });

  if ("error" in editResult) {
    return NextResponse.json({ error: editResult.error }, { status: editResult.statusCode });
  }
  return NextResponse.json({ ok: true });
}
if (action === "signup") {
  const result = await prisma.$transaction(async (tx) => {
    // Serialize all capacity changes for this call before counting slots.
    const locked = await tx.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM "guild_calls"
       WHERE id = $1 AND guild_id = $2
       FOR UPDATE`,
      id,
      auth.guild.id
    );
    if (!locked.length) return { error: "Call not found.", statusCode: 404 as const };
    if (["CANCELLED", "COMPLETED"].includes(locked[0].status)) {
      return { error: "This call is no longer open.", statusCode: 400 as const };
    }

    const member = await tx.guildMember.findFirst({
      where: {
        guildId: auth.guild.id,
        active: true,
        OR: [
          { userId: auth.user.id },
          ...(auth.user.discordId ? [{ discordUserId: auth.user.discordId }] : []),
        ],
      },
      select: { id: true },
    });
    if (!member) {
      return { error: "You need an active guild member profile to sign up.", statusCode: 400 as const };
    }

    const requirementId = String(body.requirementId ?? "");
    const selectedJob = String(body.job ?? "").trim();
    const reqRows = await tx.$queryRawUnsafe<Array<{ id: string; requirement: string; quantity: number }>>(
      `SELECT id, requirement, quantity
       FROM "guild_call_requirements"
       WHERE id = $1 AND call_id = $2`,
      requirementId,
      id
    );
    const requirement = reqRows[0];
    if (!requirement) {
      return { error: "That requirement is no longer available.", statusCode: 400 as const };
    }
    if (!(jobsForGame(gameType) as readonly string[]).includes(selectedJob)) {
      return { error: "Please select a valid job.", statusCode: 400 as const };
    }
    if (!requirementMatchesJob(requirement.requirement, selectedJob, gameType)) {
      return {
        error: `Selected job does not qualify for the ${requirement.requirement} slot.`,
        statusCode: 400 as const,
      };
    }

    const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "guild_call_participants"
       WHERE call_id = $1 AND member_id = $2`,
      id,
      member.id
    );
    if (existing.length) {
      return { error: "You are already signed up for this call.", statusCode: 409 as const };
    }

    const activeCount = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) FROM "guild_call_participants"
       WHERE call_id = $1 AND requirement_id = $2 AND status = 'ACTIVE'`,
      id,
      requirementId
    );
    const status = Number(activeCount[0]?.count ?? 0) < requirement.quantity
      ? "ACTIVE"
      : "WAITLIST";

    await tx.$executeRawUnsafe(
      `INSERT INTO "guild_call_participants"
       (id, call_id, requirement_id, member_id, job, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      newId("participant"),
      id,
      requirementId,
      member.id,
      selectedJob,
      status
    );

    const totals = await tx.$queryRawUnsafe<Array<{ required: bigint; active: bigint }>>(
      `SELECT
         COALESCE((SELECT SUM(quantity) FROM "guild_call_requirements" WHERE call_id = $1), 0) AS required,
         COALESCE((SELECT COUNT(*) FROM "guild_call_participants" WHERE call_id = $1 AND status = 'ACTIVE'), 0) AS active`,
      id
    );
    const nextStatus = Number(totals[0]?.active ?? 0) >= Number(totals[0]?.required ?? 0)
      ? "FILLED"
      : "OPEN";
    await tx.$executeRawUnsafe(
      `UPDATE "guild_calls" SET status = $2, updated_at = now() WHERE id = $1`,
      id,
      nextStatus
    );
    return { status, callStatus: nextStatus };
  }, { isolationLevel: "Serializable" });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }
  if (result.callStatus === "FILLED") {
    try {
      await announceFilledCall(id);
    } catch (error) {
      console.error("[CALL TO ARMS] announcement failed", error);
    }
  }
  return NextResponse.json({
    status: result.status,
    notificationAttempted: result.callStatus === "FILLED",
  });
}

if (action === "leave") {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM "guild_calls"
       WHERE id = $1 AND guild_id = $2
       FOR UPDATE`,
      id,
      auth.guild.id
    );
    if (!locked.length) return { error: "Call not found.", statusCode: 404 as const };

    const member = await tx.guildMember.findFirst({
      where: {
        guildId: auth.guild.id,
        active: true,
        OR: [
          { userId: auth.user.id },
          ...(auth.user.discordId ? [{ discordUserId: auth.user.discordId }] : []),
        ],
      },
      select: { id: true },
    });
    if (!member) {
      return { error: "You need an active guild member profile to leave this call.", statusCode: 400 as const };
    }

    await tx.$executeRawUnsafe(
      `DELETE FROM "guild_call_participants" WHERE call_id = $1 AND member_id = $2`,
      id,
      member.id
    );

    const requirements = await tx.$queryRawUnsafe<Array<{ id: string; quantity: number }>>(
      `SELECT id, quantity FROM "guild_call_requirements" WHERE call_id = $1`,
      id
    );
    for (const requirement of requirements) {
      const active = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) FROM "guild_call_participants"
         WHERE call_id = $1 AND requirement_id = $2 AND status = 'ACTIVE'`,
        id,
        requirement.id
      );
      const openSlots = Math.max(0, requirement.quantity - Number(active[0]?.count ?? 0));
      if (openSlots > 0) {
        await tx.$executeRawUnsafe(
          `UPDATE "guild_call_participants"
           SET status = 'ACTIVE', updated_at = now()
           WHERE id IN (
             SELECT id FROM "guild_call_participants"
             WHERE call_id = $1 AND requirement_id = $2 AND status = 'WAITLIST'
             ORDER BY signed_up_at
             LIMIT $3
           )`,
          id,
          requirement.id,
          openSlots
        );
      }
    }

    const totals = await tx.$queryRawUnsafe<Array<{ required: bigint; active: bigint }>>(
      `SELECT
         COALESCE((SELECT SUM(quantity) FROM "guild_call_requirements" WHERE call_id = $1), 0) AS required,
         COALESCE((SELECT COUNT(*) FROM "guild_call_participants" WHERE call_id = $1 AND status = 'ACTIVE'), 0) AS active`,
      id
    );
    if (!["CANCELLED", "COMPLETED"].includes(locked[0].status)) {
      const nextStatus = Number(totals[0]?.active ?? 0) >= Number(totals[0]?.required ?? 0)
        ? "FILLED"
        : "OPEN";
      await tx.$executeRawUnsafe(
        `UPDATE "guild_calls" SET status = $2, updated_at = now() WHERE id = $1`,
        id,
        nextStatus
      );
    }
    return { ok: true };
  }, { isolationLevel: "Serializable" });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }
  return NextResponse.json({ ok: true });
}

if (action === "cancel" || action === "confirm") { if (!canManage(call,auth)) return NextResponse.json({ error: "Only the creator or guild managers can do this." }, { status: 403 }); const status = action === "cancel" ? "CANCELLED" : "CONFIRMED"; await prisma.$executeRawUnsafe(`UPDATE "guild_calls" SET status = $2, updated_at = now() WHERE id = $1`, id, status); if (action === "confirm") { try { await announceConfirmedCall(id); } catch (error) { console.error("[CALL TO ARMS] confirmation announcement failed", error); } } return NextResponse.json({ ok: true, status }); } return NextResponse.json({ error: "Unknown action." }, { status: 400 }); } catch (error) { console.error("[CALL TO ARMS] action failed", error); const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : ""; if (code === "P2002" || code === "P2034") return NextResponse.json({ error: "This call changed while your request was being saved. Refresh and try again." }, { status: 409 }); return NextResponse.json({ error: "Call To Arms action failed. Please try again." }, { status: 500 }); } }