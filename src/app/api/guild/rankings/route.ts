import { NextResponse } from "next/server";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

type RankingMember = {
  id: string;
  characterName: string;
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

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET() {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!hasPermission(auth.role, "members.view")) {
      return NextResponse.json(
        { error: "You do not have permission to view guild rankings." },
        { status: 403 }
      );
    }

    const members = await prisma.guildMember.findMany({
      where: {
        guildId: auth.guild.id,
      },
      select: {
        id: true,
        characterName: true,
        job: true,
        active: true,
        eligible: true,
        priority: true,
        rosterAssignments: {
          where: {
            party: {
              roster: {
                event: {
                  guildId: auth.guild.id,
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            guildPercentile: true,
            tankScore: true,
            tankPercentile: true,
            dpsScore: true,
            dpsPercentile: true,
            pvpScore: true,
            pvpPercentile: true,
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

    const rankings: RankingMember[] = members
      .filter(
        (member) => member.rosterAssignments.length > 0
      )
      .map((member) => {
        const snapshot = member.rosterAssignments[0];

        return {
          id: member.id,
          characterName: member.characterName,
          job: member.job,
          active: member.active,
          eligible: member.eligible,
          priority: member.priority,
          guildPercentile: round(Number(snapshot.guildPercentile)),
          tankScore: round(Number(snapshot.tankScore)),
          tankPercentile: round(Number(snapshot.tankPercentile)),
          dpsScore: round(Number(snapshot.dpsScore)),
          dpsPercentile: round(Number(snapshot.dpsPercentile)),
          pvpScore: round(Number(snapshot.pvpScore)),
          pvpPercentile: round(Number(snapshot.pvpPercentile)),
          event: snapshot.party.roster.event,
          overallRank: 0,
          totalRanked: 0,
        };
      });

    rankings.sort((a, b) => {
      const difference = b.guildPercentile - a.guildPercentile;

      if (difference !== 0) {
        return difference;
      }

      return (a.characterName ?? "").localeCompare(
        b.characterName ?? ""
      );
    });

    const totalRanked = rankings.length;

    rankings.forEach((member, index) => {
      member.overallRank = index + 1;
      member.totalRanked = totalRanked;
    });

    return NextResponse.json({
      rankings,
      stats: {
        totalMembers: members.length,
        rankedMembers: totalRanked,
        unrankedMembers: members.length - totalRanked,
        activeRanked: rankings.filter((member) => member.active).length,
        inactiveRanked: rankings.filter((member) => !member.active).length,
      },
    });
  } catch (error) {
    console.error("[GUILD RANKINGS] Failed to fetch:", error);

    return NextResponse.json(
      { error: "Failed to fetch guild rankings." },
      { status: 500 }
    );
  }
}
