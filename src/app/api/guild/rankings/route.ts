import { NextResponse } from "next/server";

import { getCurrentAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { refreshGuildRankings } from "@/lib/scoring/refresh-guild-rankings";

type RankingMember = {
  id: string;
  characterName: string | null;
  job: string | null;
  active: boolean;
  eligible: boolean;
  priority: "LEADER" | "OFFICER" | "COUNCIL" | "MEMBER";
  guildPercentile: number;
  tankScore: number;
  tankPercentile: number;
  dpsScore: number;
  dpsPercentile: number;
  pvpScore: number;
  pvpPercentile: number;
  guildRank: number;
  tankRank: number;
  dpsRank: number | null;
  pvpRank: number;
  event: {
    id: string;
    type: "GUILD_LEAGUE" | "EMPERIUM_OVERRUN";
    date: Date;
  } | null;
  overallRank: number;
  totalRanked: number;
};

const DPS_JOBS = new Set([
  "Lord Knight",
  "Paladin",
  "High Wizard",
  "Sniper",
  "Assassin Cross",
  "Stalker",
  "Champion",
  "Mastersmith",
  "Biochemist (Physical)",
  "Doram (Physical)",
  "Gunslinger",
  "Super Novice",
  "Doram (Magic)",
  "Shiranui",
]);

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET() {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasPermission(auth.role, "members.view")) {
      return NextResponse.json(
        { error: "You do not have permission to view guild rankings." },
        { status: 403 }
      );
    }

    const guildId = auth.guild.id;

    const missingLiveRankings = await prisma.guildMember.count({
      where: {
        guildId,
        active: true,
        OR: [
          { guildPercentile: null },
          { tankScore: null },
          { dpsScore: null },
          { pvpScore: null },
        ],
      },
    });

    if (missingLiveRankings > 0) {
      await refreshGuildRankings(guildId);
    }

    const members = await prisma.guildMember.findMany({
      where: { guildId },
      select: {
        id: true,
        characterName: true,
        job: true,
        active: true,
        eligible: true,
        priority: true,
        guildPercentile: true,
        tankScore: true,
        tankPercentile: true,
        dpsScore: true,
        dpsPercentile: true,
        pvpScore: true,
        pvpPercentile: true,
        guildRank: true,
        tankRank: true,
        dpsRank: true,
        pvpRank: true,
        rosterAssignments: {
          where: {
            party: {
              roster: {
                event: { guildId },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
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
        (member) =>
          member.active &&
          member.guildPercentile !== null &&
          member.tankScore !== null &&
          member.dpsScore !== null &&
          member.pvpScore !== null &&
          member.guildRank !== null &&
          member.tankRank !== null &&
          member.pvpRank !== null
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
          guildPercentile: round(Number(member.guildPercentile)),
          tankScore: round(Number(member.tankScore)),
          tankPercentile: round(Number(member.tankPercentile ?? 0)),
          dpsScore: round(Number(member.dpsScore)),
          dpsPercentile: round(Number(member.dpsPercentile ?? 0)),
          pvpScore: round(Number(member.pvpScore)),
          pvpPercentile: round(Number(member.pvpPercentile ?? 0)),
          guildRank: member.guildRank!,
          tankRank: member.tankRank!,
          dpsRank: DPS_JOBS.has(member.job ?? "") ? member.dpsRank : null,
          pvpRank: member.pvpRank!,
          event: snapshot?.party.roster.event ?? null,
          overallRank: member.guildRank!,
          totalRanked: 0,
        };
      });

    rankings.sort((a, b) => {
      if (a.guildRank !== b.guildRank) return a.guildRank - b.guildRank;
      return (a.characterName ?? "").localeCompare(b.characterName ?? "");
    });

    const totalRanked = rankings.length;
    rankings.forEach((member) => {
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
