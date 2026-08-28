import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    memberId: string;
  }>;
};

// =============================================================
// GET MEMBER PROFILE
// =============================================================

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "members.view"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view members.",
        },
        { status: 403 }
      );
    }

    const {
      memberId,
    } = await context.params;

    const member =
      await prisma.guildMember.findFirst(
        {
          where: {
            id: memberId,

            guildId:
              auth.guild.id,
          },

          include: {
            leaveDates: {
              orderBy: {
                date: "asc",
              },

              select: {
                id: true,
                date: true,
                reason: true,
              },
            },

            rosterAssignments: {
              where: {
                party: {
                  roster: {
                    event: {
                      guildId:
                        auth.guild.id,
                    },
                  },
                },
              },

              orderBy: {
                createdAt: "desc",
              },

              include: {
                party: {
                  include: {
                    roster: {
                      include: {
                        event: {
                          select: {
                            id: true,
                            type: true,
                            date: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }
      );

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Guild member not found.",
        },
        { status: 404 }
      );
    }

    // ==========================================================
    // CURRENT SCORE SNAPSHOT
    // ==========================================================

    const latestAssignment =
      member.rosterAssignments[0] ??
      null;

    const current =
      latestAssignment
        ? {
            guildPercentile:
              latestAssignment.guildPercentile,

            tankScore:
              latestAssignment.tankScore,

            dpsScore:
              latestAssignment.dpsScore,

            pvpScore:
              latestAssignment.pvpScore,

            event: {
              id:
                latestAssignment
                  .party.roster.event.id,

              type:
                latestAssignment
                  .party.roster.event.type,

              date:
                latestAssignment
                  .party.roster.event.date,

              battlefield:
                latestAssignment
                  .party.battlefield,

              partyNumber:
                latestAssignment
                  .party.partyNumber,

              slotNumber:
                latestAssignment
                  .slotNumber,
            },
          }
        : null;

    // ==========================================================
    // ROSTER HISTORY
    // ==========================================================

    const history =
      member.rosterAssignments.map(
        (assignment) => ({
          rosterMemberId:
            assignment.id,

          event: {
            id:
              assignment
                .party.roster.event.id,

            type:
              assignment
                .party.roster.event.type,

            date:
              assignment
                .party.roster.event.date,
          },

          battlefield:
            assignment.party
              .battlefield,

          partyNumber:
            assignment.party
              .partyNumber,

          slotNumber:
            assignment.slotNumber,

          guildPercentile:
            assignment.guildPercentile,

          tankScore:
            assignment.tankScore,

          dpsScore:
            assignment.dpsScore,

          pvpScore:
            assignment.pvpScore,

          createdAt:
            assignment.createdAt,
        })
      );

    return NextResponse.json({
      member: {
        id: member.id,

        characterName:
          member.characterName,

        job:
          member.job,

        active:
          member.active,

        eligible:
          member.eligible,

        priority:
          member.priority,

        remarks:
          member.remarks,

        pdef:
          member.pdef,

        mdef:
          member.mdef,

        patk:
          member.patk,

        matk:
          member.matk,

        hp:
          member.hp,

        critRes:
          member.critRes,

        ignorePdef:
          member.ignorePdef,

        ignoreMdef:
          member.ignoreMdef,

        pvpDamageBonus:
          member.pvpDamageBonus,

        pvpDamageReduction:
          member.pvpDamageReduction,

        pdmgPercent:
          member.pdmgPercent,

        mdmgPercent:
          member.mdmgPercent,

        pdmgReductionPercent:
          member.pdmgReductionPercent,

        mdmgReductionPercent:
          member.mdmgReductionPercent,

        damageVsSmall:
          member.damageVsSmall,

        damageReductionVsSmall:
          member.damageReductionVsSmall,

        damageVsMedium:
          member.damageVsMedium,

        damageReductionVsMedium:
          member.damageReductionVsMedium,

        damageVsDemiHuman:
          member.damageVsDemiHuman,

        damageReductionVsDemiHuman:
          member.damageReductionVsDemiHuman,

        damageVsBrute:
          member.damageVsBrute,

        damageReductionVsBrute:
          member.damageReductionVsBrute,

        equipmentPdefPercent:
          member.equipmentPdefPercent,

        equipmentMdefPercent:
          member.equipmentMdefPercent,

        leaveDates:
          member.leaveDates,
      },

      current,

      history,
    });
  } catch (error) {
    console.error(
      "[MEMBER PROFILE] Failed to fetch:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch member profile.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// DELETE MEMBER
// =============================================================

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "members.delete"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete members.",
        },
        { status: 403 }
      );
    }

    const {
      memberId,
    } = await context.params;

    if (!memberId) {
      return NextResponse.json(
        {
          error:
            "Member ID is required.",
        },
        { status: 400 }
      );
    }

    const member =
      await prisma.guildMember.findFirst(
        {
          where: {
            id: memberId,

            guildId:
              auth.guild.id,
          },

          select: {
            id: true,
            characterName: true,
          },
        }
      );

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Guild member not found.",
        },
        { status: 404 }
      );
    }

    await prisma.guildMember.delete(
      {
        where: {
          id: memberId,
        },
      }
    );

    return NextResponse.json({
      success: true,
      id: memberId,
    });
  } catch (error) {
    console.error(
      "[MEMBER PROFILE] Failed to delete member:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete member.",
      },
      { status: 500 }
    );
  }
}
