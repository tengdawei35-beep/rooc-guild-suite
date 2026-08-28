import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RankingMember = {
  id: string;

  displayName: string;
  characterName: string | null;
  job: string | null;

  active: boolean;
  eligible: boolean;

  priority:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";

  guildPercentile: number;

  tankScore: number;
  tankPercentile: number;

  dpsScore: number;
  dpsPercentile: number;

  pvpScore: number;
  pvpPercentile: number;

  event: {
    id: string;
    type:
      | "GUILD_LEAGUE"
      | "EMPERIUM_OVERRUN";
    date: Date;
  } | null;

  overallRank: number;
  totalRanked: number;
};

async function getGuild() {
  return prisma.guild.findFirst({
    select: {
      id: true,
    },
  });
}

function round(
  value: number
) {
  return Math.round(
    value * 100
  ) / 100;
}

export async function GET() {
  try {
    const guild =
      await getGuild();

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured.",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================================
    // LOAD CURRENT MEMBERS + LATEST RANKING SNAPSHOT
    // ==========================================================

    const members =
      await prisma.guildMember.findMany({
        where: {
          guildId:
            guild.id,
        },

        select: {
          id: true,
          displayName: true,
          characterName: true,
          job: true,
          active: true,
          eligible: true,
          priority: true,

          rosterAssignments: {
            orderBy: {
              createdAt:
                "desc",
            },

            take: 1,

            select: {
              guildPercentile:
                true,

              tankScore:
                true,

              tankPercentile:
                true,

              dpsScore:
                true,

              dpsPercentile:
                true,

              pvpScore:
                true,

              pvpPercentile:
                true,

              party: {
                select: {
                  roster: {
                    select: {
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
      });

    // ==========================================================
    // ONLY MEMBERS WITH A SNAPSHOT ARE RANKED
    // ==========================================================

    const rankings =
      members
        .filter(
          (member) =>
            member
              .rosterAssignments
              .length > 0
        )
        .map(
          (member) => {
            const snapshot =
              member
                .rosterAssignments[0];

            return {
              id:
                member.id,

              displayName:
                member.displayName,

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

              guildPercentile:
                round(
                  Number(
                    snapshot.guildPercentile
                  )
                ),

              tankScore:
                round(
                  Number(
                    snapshot.tankScore
                  )
                ),

              tankPercentile:
                round(
                  Number(
                    snapshot.tankPercentile
                  )
                ),

              dpsScore:
                round(
                  Number(
                    snapshot.dpsScore
                  )
                ),

              dpsPercentile:
                round(
                  Number(
                    snapshot.dpsPercentile
                  )
                ),

              pvpScore:
                round(
                  Number(
                    snapshot.pvpScore
                  )
                ),

              pvpPercentile:
                round(
                  Number(
                    snapshot.pvpPercentile
                  )
                ),

              event:
                snapshot.party
                  .roster.event,

              overallRank:
                0,

              totalRanked:
                0,
            };
          }
        );

    // ==========================================================
    // OVERALL RANK
    // ==========================================================

    rankings.sort(
      (a, b) => {
        const difference =
          b.guildPercentile -
          a.guildPercentile;

        if (
          difference !== 0
        ) {
          return difference;
        }

        return (
          a.characterName ??
          a.displayName
        ).localeCompare(
          b.characterName ??
            b.displayName
        );
      }
    );

    const totalRanked =
      rankings.length;

    rankings.forEach(
      (member, index) => {
        member.overallRank =
          index + 1;

        member.totalRanked =
          totalRanked;
      }
    );

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return NextResponse.json({
      rankings,

      stats: {
        totalMembers:
          members.length,

        rankedMembers:
          totalRanked,

        unrankedMembers:
          members.length -
          totalRanked,

        activeRanked:
          rankings.filter(
            (member) =>
              member.active
          ).length,

        inactiveRanked:
          rankings.filter(
            (member) =>
              !member.active
          ).length,
      },
    });
  } catch (error) {
    console.error(
      "[GUILD RANKINGS] Failed to fetch:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch guild rankings.",
      },
      {
        status: 500,
      }
    );
  }
}