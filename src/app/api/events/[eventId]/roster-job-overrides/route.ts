import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth, hasPermission } from "@/lib/auth";

const JOB_MAX_LENGTH = 60;

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return errorResponse("Authentication required.", 401);

    const { eventId } = await context.params;

    const rows = await prisma.$queryRawUnsafe<Array<{
      rosterId: string;
      rosterName: string;
      rosterCreatedAt: Date;
      partyId: string;
      partyNumber: number;
      battlefield: string;
      assignmentId: string;
      slotNumber: number;
      memberId: string;
      characterName: string | null;
      submittedJob: string | null;
      overrideJob: string | null;
    }>>(
      `SELECT
        r.id AS "rosterId",
        r.name AS "rosterName",
        r."createdAt" AS "rosterCreatedAt",
        rp.id AS "partyId",
        rp."partyNumber" AS "partyNumber",
        rp.battlefield::text AS "battlefield",
        rm.id AS "assignmentId",
        rm."slotNumber" AS "slotNumber",
        gm.id AS "memberId",
        gm."characterName" AS "characterName",
        gm.job AS "submittedJob",
        rjo.job AS "overrideJob"
      FROM "Roster" r
      JOIN "RosterParty" rp ON rp."rosterId" = r.id
      JOIN "RosterMember" rm ON rm."partyId" = rp.id
      JOIN "GuildMember" gm ON gm.id = rm."memberId"
      LEFT JOIN "RosterJobOverride" rjo ON rjo."rosterMemberId" = rm.id
      JOIN "Event" e ON e.id = r."eventId"
      WHERE e.id = $1 AND e."guildId" = $2
      ORDER BY r."createdAt" DESC, rp.battlefield ASC, rp."partyNumber" ASC, rm."slotNumber" ASC`,
      eventId,
      auth.guild.id
    );

    return NextResponse.json({ assignments: rows });
  } catch (error) {
    console.error("[ROSTER JOB OVERRIDES] GET failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to load roster job overrides.",
      500
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return errorResponse("Authentication required.", 401);
    if (!hasPermission(auth.role, "rosters.edit")) {
      return errorResponse("You do not have permission to edit rosters.", 403);
    }

    const { eventId } = await context.params;
    const body = (await request.json()) as {
      assignmentId?: unknown;
      job?: unknown;
    };

    if (typeof body.assignmentId !== "string" || !body.assignmentId) {
      return errorResponse("Assignment ID is required.", 400);
    }

    const rawJob = typeof body.job === "string" ? body.job.trim() : "";
    if (rawJob.length > JOB_MAX_LENGTH) {
      return errorResponse(`Job must be ${JOB_MAX_LENGTH} characters or fewer.`, 400);
    }

    const assignment = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT rm.id
       FROM "RosterMember" rm
       JOIN "RosterParty" rp ON rp.id = rm."partyId"
       JOIN "Roster" r ON r.id = rp."rosterId"
       JOIN "Event" e ON e.id = r."eventId"
       WHERE rm.id = $1 AND e.id = $2 AND e."guildId" = $3
       LIMIT 1`,
      body.assignmentId,
      eventId,
      auth.guild.id
    );

    if (!assignment[0]) return errorResponse("Roster assignment not found.", 404);

    if (!rawJob) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "RosterJobOverride" WHERE "rosterMemberId" = $1`,
        body.assignmentId
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RosterJobOverride" ("id", "rosterMemberId", "job")
         VALUES (gen_random_uuid()::text, $1, $2)
         ON CONFLICT ("rosterMemberId")
         DO UPDATE SET "job" = EXCLUDED."job", "updatedAt" = CURRENT_TIMESTAMP`,
        body.assignmentId,
        rawJob
      );
    }

    return NextResponse.json({
      success: true,
      assignmentId: body.assignmentId,
      overrideJob: rawJob || null,
    });
  } catch (error) {
    console.error("[ROSTER JOB OVERRIDES] PATCH failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update roster job.",
      500
    );
  }
}
