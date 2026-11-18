import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, "rosters.edit")) {
      return NextResponse.json(
        { error: "You do not have permission to manage preferred rosters." },
        { status: 403 }
      );
    }

    const { eventId } = await context.params;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        guildId: auth.guild.id,
      },
      include: {
        rosters: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            parties: {
              orderBy: [
                { battlefield: "asc" },
                { partyNumber: "asc" },
              ],
              include: {
                members: {
                  orderBy: { slotNumber: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const roster = event.rosters[0];
    if (!roster) {
      return NextResponse.json(
        { error: "This event does not have a roster to save." },
        { status: 400 }
      );
    }

    const memberIds = roster.parties.flatMap((party) =>
      party.members.map((member) => member.memberId)
    );

    if (memberIds.length > 0) {
      const uniqueMemberIds = Array.from(new Set(memberIds));
      const guildMembers = await prisma.guildMember.findMany({
        where: {
          id: { in: uniqueMemberIds },
          guildId: auth.guild.id,
        },
        select: { id: true },
      });

      const validMemberIds = new Set(guildMembers.map((member) => member.id));
      const hasInvalidMember = uniqueMemberIds.some(
        (memberId) => !validMemberIds.has(memberId)
      );

      if (hasInvalidMember) {
        return NextResponse.json(
          { error: "The roster contains a member that does not belong to this guild." },
          { status: 400 }
        );
      }
    }

    const preferred = await prisma.$transaction(async (tx) => {
      const existing = await tx.preferredRoster.findUnique({
        where: {
          guildId_type: {
            guildId: auth.guild.id,
            type: event.type,
          },
        },
      });

      if (existing) {
        await tx.preferredRoster.delete({
          where: { id: existing.id },
        });
      }

      return tx.preferredRoster.create({
        data: {
          guildId: auth.guild.id,
          type: event.type,
          parties: {
            create: roster.parties.map((party) => ({
              battlefield: party.battlefield,
              partyNumber: party.partyNumber,
              members: {
                create: party.members.map((member) => ({
                  memberId: member.memberId,
                  slotNumber: member.slotNumber,
                })),
              },
            })),
          },
        },
        include: {
          parties: {
            include: {
              members: true,
            },
          },
        },
      });
    });

    // Preserve any per-roster job overrides when this roster becomes preferred.
    // The preferred override is linked to the copied PreferredRosterMember row,
    // so future automatically generated rosters can inherit the appointment.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PreferredRosterJobOverride" ("id", "preferredRosterMemberId", "job")
       SELECT
         CONCAT('pro-', rm.id),
         prm.id,
         rjo.job
       FROM "RosterJobOverride" rjo
       JOIN "RosterMember" rm ON rm.id = rjo."rosterMemberId"
       JOIN "RosterParty" rp ON rp.id = rm."partyId"
       JOIN "PreferredRosterParty" prp
         ON prp."preferredRosterId" = $1
        AND prp.battlefield = rp.battlefield
        AND prp."partyNumber" = rp."partyNumber"
       JOIN "PreferredRosterMember" prm
         ON prm."preferredRosterPartyId" = prp.id
        AND prm."memberId" = rm."memberId"
        AND prm."slotNumber" = rm."slotNumber"
       WHERE rp."rosterId" = $2
       ON CONFLICT ("preferredRosterMemberId")
       DO UPDATE SET "job" = EXCLUDED."job", "updatedAt" = CURRENT_TIMESTAMP`,
      preferred.id,
      roster.id
    );

    return NextResponse.json({
      success: true,
      preferredRoster: preferred,
    });
  } catch (error) {
    console.error("[PREFERRED ROSTER] Failed to save:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save preferred roster.",
      },
      { status: 500 }
    );
  }
}
