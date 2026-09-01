import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRosterUpdate } from "@/lib/discord-notifications";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

const PARTY_SIZE = 5;

type Battlefield =
  | "BATTLEFIELD_1"
  | "BATTLEFIELD_2";

type EventType =
  | "GUILD_LEAGUE"
  | "EMPERIUM_OVERRUN";

type PreferredRole =
  | "PRIEST"
  | "GYPSY"
  | "SUPPORT"
  | "DPS";

type RankingMember = {
  id: string;
  characterName: string | null;
  job: string | null;
  priority:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";

  pdef: number | null;
  mdef: number | null;

  pvpDamageBonus: number | null;
  pvpDamageReduction: number | null;

  pdmgPercent: number | null;
  mdmgPercent: number | null;

  pdmgReductionPercent: number | null;
  mdmgReductionPercent: number | null;

  critRes: number | null;

  ignorePdef: number | null;
  ignoreMdef: number | null;

  damageVsMedium: number | null;
  damageReductionVsMedium: number | null;

  damageVsDemiHuman: number | null;
  damageReductionVsDemiHuman: number | null;

  patk: number | null;
  matk: number | null;
  hp: number | null;
};

type RankedMember =
  RankingMember & {
    tankScore: number;
    tankPercentile: number;

    dpsScore: number;
    dpsPercentile: number;

    pvpScore: number;
    pvpPercentile: number;

    guildPercentile: number;
  };

type PreferredMember = {
  memberId: string;
  slotNumber: number;
};

type PreferredParty = {
  battlefield: Battlefield;
  partyNumber: number;
  members: PreferredMember[];
};

type PartySlot = {
  member: RankedMember | null;
  preferred: boolean;
};

type GeneratedParty = {
  battlefield: Battlefield;
  partyNumber: number;

  slots: PartySlot[];
};

// =============================================================
// POST
// =============================================================

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    // ==========================================================
    // AUTHENTICATION
    // ==========================================================

    const auth =
      await getCurrentAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================================
    // PERMISSION
    // ==========================================================

    if (
      !hasPermission(
        auth.role,
        "rosters.edit"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage rosters.",
        },
        {
          status: 403,
        }
      );
    }

    const { eventId } =
      await context.params;

    const body =
      await _request.json().catch(() => ({}));

    const mode =
      body?.mode === "PREFERRED"
        ? "PREFERRED"
        : "AUTOMATIC";

    // ==========================================================
    // LOAD EVENT
    // ==========================================================
    //
    // IMPORTANT:
    // findFirst is intentional here.
    //
    // eventId is unique by itself, but we also need to enforce
    // that the event belongs to the authenticated user's guild.
    //
    // Using findFirst allows both conditions to be checked.
    // ==========================================================

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,

          guildId:
            auth.guild.id,
        },

        select: {
          id: true,
          guildId: true,
          type: true,
          date: true,
        },
      });

    if (!event) {
      return NextResponse.json(
        {
          error:
            "Event not found.",
        },
        {
          status: 404,
        }
      );
    }

    const eventType =
      event.type as EventType;

    // ==========================================================
    // ROSTER RULES
    // ==========================================================

    const rules =
      getRosterRules(eventType);

    const totalCapacity =
      rules.battlefields.length *
      rules.maxMembersPerBattlefield;

    const totalParties =
      rules.battlefields.length *
      rules.partiesPerBattlefield;

    // ==========================================================
    // EVENT DATE
    // ==========================================================

    const eventDateStart =
      new Date(event.date);

    const eventDateEnd =
      new Date(
        eventDateStart.getTime() +
          24 * 60 * 60 * 1000
      );

    // ==========================================================
    // LOAD ACTIVE GUILD MEMBERS
    // ==========================================================

    const guildMembers =
      await prisma.guildMember.findMany({
        where: {
          guildId:
            event.guildId,

          active: true,
        },

        select: {
          id: true,
          characterName: true,
          job: true,
          priority: true,

          pdef: true,
          mdef: true,

          pvpDamageBonus: true,
          pvpDamageReduction: true,

          pdmgPercent: true,
          mdmgPercent: true,

          pdmgReductionPercent: true,
          mdmgReductionPercent: true,

          critRes: true,

          ignorePdef: true,
          ignoreMdef: true,

          damageVsMedium: true,
          damageReductionVsMedium: true,

          damageVsDemiHuman: true,
          damageReductionVsDemiHuman: true,

          patk: true,
          matk: true,
          hp: true,

          leaveDates: {
            where: {
              date: {
                gte: eventDateStart,
                lt: eventDateEnd,
              },
            },

            select: {
              id: true,
            },
          },
        },

        orderBy: [
          {
            priority: "asc",
          },
          {
            characterName: "asc",
          },
        ],
      });

    // ==========================================================
    // BUILD RANKING DATA
    // ==========================================================

    const rankingMembers:
      RankingMember[] =
      guildMembers.map(
        (member) => ({
          id:
            member.id,

          characterName:
            member.characterName,

          job:
            member.job,

          priority:
            member.priority,

          pdef:
            member.pdef,

          mdef:
            member.mdef,

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

          critRes:
            member.critRes,

          ignorePdef:
            member.ignorePdef,

          ignoreMdef:
            member.ignoreMdef,

          damageVsMedium:
            member.damageVsMedium,

          damageReductionVsMedium:
            member.damageReductionVsMedium,

          damageVsDemiHuman:
            member.damageVsDemiHuman,

          damageReductionVsDemiHuman:
            member.damageReductionVsDemiHuman,

          patk:
            member.patk,

          matk:
            member.matk,

          hp:
            member.hp,
        })
      );

    // ==========================================================
    // CALCULATE SCORES
    // ==========================================================

    const metrics =
      buildMetrics(
        rankingMembers
      );

    const rankedMembers:
      RankedMember[] =
      rankingMembers.map(
        (member) => {
          const scores =
            calculateScores(
              member,
              metrics
            );

          return {
            ...member,

            tankScore:
              scores.tankScore,

            tankPercentile:
              0,

            dpsScore:
              scores.dpsScore,

            dpsPercentile:
              0,

            pvpScore:
              scores.pvpScore,

            pvpPercentile:
              0,

            guildPercentile:
              0,
          };
        }
      );

    // ==========================================================
    // CALCULATE GUILD PERCENTILE
    // ==========================================================

    const guildPvPScores =
      rankedMembers.map(
        (member) =>
          member.pvpScore
      );

    for (
      const member of rankedMembers
    ) {
      member.guildPercentile =
        percentile(
          member.pvpScore,
          guildPvPScores
        );
    }

    // ==========================================================
    // EVENT PARTICIPATION
    // ==========================================================

    const participationRows =
      await prisma.eventParticipation.findMany({
        where: {
          eventId:
            event.id,
        },

        select: {
          memberId: true,
          available: true,
        },
      });

    const participationMap =
      new Map<string, boolean>();

    for (
      const participation of
        participationRows
    ) {
      participationMap.set(
        participation.memberId,
        participation.available
      );
    }

    // ==========================================================
    // DETERMINE EVENT-AVAILABLE MEMBERS
    // ==========================================================

    const eventAvailableMembers =
      rankedMembers.filter(
        (member) => {
          const guildMember =
            guildMembers.find(
              (candidate) =>
                candidate.id ===
                member.id
            );

          if (!guildMember) {
            return false;
          }

          // Leave always overrides availability.
          if (
            guildMember.leaveDates
              .length > 0
          ) {
            return false;
          }

          // No participation record means available.
          const available =
            participationMap.get(
              member.id
            );

          if (
            available ===
            undefined
          ) {
            return true;
          }

          return available;
        }
      );

    // ==========================================================
    // LOAD PREFERRED ROSTER
    // ==========================================================

    const preferredRoster =
      await prisma.preferredRoster.findUnique({
        where: {
          guildId_type: {
            guildId:
              event.guildId,

            type:
              event.type,
          },
        },

        include: {
          parties: {
            orderBy: [
              {
                battlefield:
                  "asc",
              },
              {
                partyNumber:
                  "asc",
              },
            ],

            include: {
              members: {
                orderBy: {
                  slotNumber:
                    "asc",
                },
              },
            },
          },
        },
      });

    const preferredParties:
      PreferredParty[] =
      preferredRoster
        ? preferredRoster.parties.map(
            (party) => ({
              battlefield:
                party.battlefield as Battlefield,

              partyNumber:
                party.partyNumber,

              members:
                party.members.map(
                  (member) => ({
                    memberId:
                      member.memberId,

                    slotNumber:
                      member.slotNumber,
                  })
                ),
            })
          )
        : [];

    // ==========================================================
    // CREATE PARTY STRUCTURE
    // ==========================================================

    const parties:
      GeneratedParty[] =
      [];

    for (
      const battlefield of
        rules.battlefields
    ) {
      for (
        let partyNumber = 1;
        partyNumber <=
        rules.partiesPerBattlefield;
        partyNumber++
      ) {
        parties.push({
          battlefield,
          partyNumber,

          slots:
            Array.from(
              {
                length:
                  PARTY_SIZE,
              },
              () => ({
                member:
                  null,

                preferred:
                  false,
              })
            ),
        });
      }
    }

    // ==========================================================
    // REMAINING MEMBERS
    // ==========================================================

    const remaining =
      new Map<
        string,
        RankedMember
      >();

    for (
      const member of
        eventAvailableMembers
    ) {
      remaining.set(
        member.id,
        member
      );
    }

    // ==========================================================
    // PASS 1
    //
    // APPLY PREFERRED ROSTER
    // ==========================================================
    if (mode === "PREFERRED"){
    for (
      const preferred of
        preferredParties
    ) {
      const party =
        parties.find(
          (candidate) =>
            candidate.battlefield ===
              preferred.battlefield &&
            candidate.partyNumber ===
              preferred.partyNumber
        );

      if (!party) {
        continue;
      }

      for (
        const preferredMember of
          preferred.members
      ) {
        const slotIndex =
          preferredMember.slotNumber -
          1;

        if (
          slotIndex < 0 ||
          slotIndex >=
            PARTY_SIZE
        ) {
          continue;
        }

        const member =
          remaining.get(
            preferredMember.memberId
          );

        // Member is unavailable, so leave the slot empty.
        if (!member) {
          continue;
        }

        // Prevent malformed preferred rosters from assigning
        // the same member twice.
        const alreadyAssigned =
          parties.some(
            (candidateParty) =>
              candidateParty.slots.some(
                (slot) =>
                  slot.member?.id ===
                  member.id
              )
          );

        if (
          alreadyAssigned
        ) {
          continue;
        }

        party.slots[
          slotIndex
        ] = {
          member,
          preferred:
            true,
        };

        remaining.delete(
          member.id
        );
      }
    }

    // ==========================================================
    // PASS 2
    //
    // FILL VACANCIES IN PREFERRED PARTIES FIRST.
    // ==========================================================

    for (
      const party of parties
    ) {
      const hasPreferredSlot =
        party.slots.some(
          (slot) =>
            slot.preferred
        );

      if (
        !hasPreferredSlot
      ) {
        continue;
      }

      while (
        party.slots.some(
          (slot) =>
            slot.member ===
            null
        ) &&
        remaining.size > 0
      ) {
        const currentMembers =
          party.slots
            .filter(
              (
                slot
              ) =>
                slot.member !==
                null
            )
            .map(
              (
                slot
              ) =>
                slot.member!
            );

        const selected =
          selectBestCandidate(
            [
              ...remaining.values(),
            ],
            currentMembers
          );

        if (!selected) {
          break;
        }

        const emptySlotIndex =
          party.slots.findIndex(
            (slot) =>
              slot.member ===
              null
          );

        if (
          emptySlotIndex ===
          -1
        ) {
          break;
        }

        party.slots[
          emptySlotIndex
        ] = {
          member:
            selected,

          preferred:
            false,
        };

        remaining.delete(
          selected.id
        );
      }
    }
    }

    // ==========================================================
    // PASS 3
    //
    // COMPLETE NORMAL PARTIES.
    // ==========================================================

    for (
      const party of parties
    ) {
      while (
        party.slots.some(
          (slot) =>
            slot.member ===
            null
        ) &&
        remaining.size > 0
      ) {
        const currentMembers =
          party.slots
            .filter(
              (
                slot
              ) =>
                slot.member !==
                null
            )
            .map(
              (
                slot
              ) =>
                slot.member!
            );

        const selected =
          selectBestCandidate(
            [
              ...remaining.values(),
            ],
            currentMembers
          );

        if (!selected) {
          break;
        }

        const emptySlotIndex =
          party.slots.findIndex(
            (slot) =>
              slot.member ===
              null
          );

        if (
          emptySlotIndex ===
          -1
        ) {
          break;
        }

        party.slots[
          emptySlotIndex
        ] = {
          member:
            selected,

          preferred:
            false,
        };

        remaining.delete(
          selected.id
        );
      }
    }

    // ==========================================================
    // PASS 4
    //
    // FALLBACK DISTRIBUTION
    // ==========================================================

    if (
      remaining.size > 0
    ) {
      for (
        const party of parties
      ) {
        while (
          party.slots.some(
            (slot) =>
              slot.member ===
              null
          ) &&
          remaining.size > 0
        ) {
          const candidate =
            [
              ...remaining.values(),
            ].sort(
              compareByPercentile
            )[0];

          if (!candidate) {
            break;
          }

          const emptySlotIndex =
            party.slots.findIndex(
              (slot) =>
                slot.member ===
                null
            );

          if (
            emptySlotIndex ===
            -1
          ) {
            break;
          }

          party.slots[
            emptySlotIndex
          ] = {
            member:
              candidate,

            preferred:
              false,
          };

          remaining.delete(
            candidate.id
          );
        }

        if (
          remaining.size ===
          0
        ) {
          break;
        }
      }
    }

    // ==========================================================
    // VALIDATE ASSIGNMENTS
    // ==========================================================

    const assignedIds =
      new Set<string>();

    for (
      const party of parties
    ) {
      let memberCount =
        0;

      for (
        const slot of
          party.slots
      ) {
        if (
          !slot.member
        ) {
          continue;
        }

        memberCount++;

        if (
          assignedIds.has(
            slot.member.id
          )
        ) {
          throw new Error(
            `Member ${slot.member.characterName} was assigned more than once.`
          );
        }

        assignedIds.add(
          slot.member.id
        );
      }

      if (
        memberCount >
        PARTY_SIZE
      ) {
        throw new Error(
          `Party ${party.partyNumber} exceeded ${PARTY_SIZE} members.`
        );
      }
    }

    // ==========================================================
    // FLATTEN ASSIGNED MEMBERS
    // ==========================================================

    const assignedMembers =
      eventAvailableMembers.filter(
        (member) =>
          assignedIds.has(
            member.id
          )
      );

    const unassignedMembers =
      Math.max(
        0,
        eventAvailableMembers.length -
          assignedMembers.length
      );

    // ==========================================================
    // CREATE ROSTER
    // ==========================================================

    const roster =
      await prisma.$transaction(
        async (tx) => {
          const createdRoster =
            await tx.roster.create({
              data: {
                eventId:
                  event.id,

              name:
                mode === "PREFERRED"
                  ? `Preferred - ${formatEventType(
                      eventType
                    )} - ${formatDate(
                      event.date
                    )}`
                  : `${formatEventType(
                      eventType
                    )} - ${formatDate(
                      event.date
                    )}`,

                generationMode:
                  mode === "PREFERRED"
                    ? "PREFERRED"
                    : "AUTOMATIC",
              },
            });

          for (
            const party of parties
          ) {
            const createdParty =
              await tx.rosterParty.create({
                data: {
                  rosterId:
                    createdRoster.id,

                  battlefield:
                    party.battlefield,

                  partyNumber:
                    party.partyNumber,
                },
              });

            for (
              let slotIndex = 0;
              slotIndex <
              party.slots.length;
              slotIndex++
            ) {
              const slot =
                party.slots[
                  slotIndex
                ];

              if (
                !slot.member
              ) {
                continue;
              }

              await tx.rosterMember.create({
                data: {
                  partyId:
                    createdParty.id,

                  memberId:
                    slot.member.id,

                  slotNumber:
                    slotIndex + 1,

                  guildPercentile:
                    slot.member
                      .guildPercentile,

                  tankScore:
                    slot.member
                      .tankScore,

                  dpsScore:
                    slot.member
                      .dpsScore,

                  pvpScore:
                    slot.member
                      .pvpScore,

                  tankPercentile:
                    slot.member
                      .tankPercentile,

                  dpsPercentile:
                    slot.member
                      .dpsPercentile,

                  pvpPercentile:
                    slot.member
                      .pvpPercentile,
                },
              });
            }
          }

          return createdRoster;
        }
      );

    // ==========================================================
    // LOAD COMPLETE ROSTER
    // ==========================================================

    const completeRoster =
      await prisma.roster.findUnique({
        where: {
          id: roster.id,
        },

        include: {
          parties: {
            orderBy: [
              {
                battlefield:
                  "asc",
              },
              {
                partyNumber:
                  "asc",
              },
            ],

            include: {
              members: {
                orderBy: {
                  slotNumber:
                    "asc",
                },

                include: {
                  member: {
                    select: {
                      id: true,
                      characterName:
                        true,
                      job: true,
                      priority:
                        true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!completeRoster) {
      throw new Error(
        "Roster was created but could not be loaded."
      );
    }

    // ==========================================================
    // PARTY STATISTICS
    // ==========================================================

    const partyStats =
      parties.map(
        (party) => {
          const members =
            party.slots
              .filter(
                (slot) =>
                  slot.member !==
                  null
              )
              .map(
                (slot) =>
                  slot.member!
              );

          return {
            battlefield:
              party.battlefield,

            partyNumber:
              party.partyNumber,

            memberCount:
              members.length,

            averagePercentile:
              members.length
                ? members.reduce(
                    (
                      sum,
                      member
                    ) =>
                      sum +
                      member.guildPercentile,
                    0
                  ) /
                  members.length
                : 0,

            jobs:
              countJobs(
                members
              ),

            roles:
              countRoles(
                members
              ),
          };
        }
      );

    await notifyRosterUpdate({
      guildId: auth.guild.id,
      eventId: event.id,
      rosterId: roster.id,
    });

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return NextResponse.json(
      {
        success: true,

        roster:
          completeRoster,

        stats: {
          guildMemberCount:
            guildMembers.length,

          availableMembers:
            eventAvailableMembers.length,

          assignedMembers:
            assignedMembers.length,

          unassignedMembers,

          capacity:
            totalCapacity,

          partyCount:
            totalParties,

          partySize:
            PARTY_SIZE,

          battlefieldCount:
            rules.battlefields.length,

          usedPreferredRoster:
            preferredParties.length >
            0,

          partyStats,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "[ROSTER GENERATION]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate roster.",
      },
      {
        status: 500,
      }
    );
  }
}

// =============================================================
// SELECT BEST CANDIDATE
// =============================================================

function selectBestCandidate(
  candidates: RankedMember[],
  currentParty: RankedMember[]
) {
  if (
    candidates.length ===
    0
  ) {
    return null;
  }

  const roleCounts =
    countRoles(
      currentParty
    );

  const requiredRoles =
    getRequiredRoles(
      roleCounts
    );

  for (
    const role of
      requiredRoles
  ) {
    const roleCandidates =
      candidates.filter(
        (candidate) =>
          getPreferredRole(
            candidate
          ) === role
      );

    if (
      roleCandidates.length ===
      0
    ) {
      continue;
    }

    return chooseBestCandidate(
      roleCandidates,
      currentParty
    );
  }

  const dpsCandidates =
    candidates.filter(
      (candidate) =>
        getPreferredRole(
          candidate
        ) === "DPS"
    );

  if (
    dpsCandidates.length >
    0
  ) {
    return chooseBestCandidate(
      dpsCandidates,
      currentParty
    );
  }

  return chooseBestCandidate(
    candidates,
    currentParty
  );
}

// =============================================================
// REQUIRED ROLES
// =============================================================

function getRequiredRoles(
  roleCounts: Record<
    PreferredRole,
    number
  >
): PreferredRole[] {
  const required:
    PreferredRole[] =
    [];

  if (
    roleCounts.PRIEST <
    1
  ) {
    required.push(
      "PRIEST"
    );
  }

  if (
    roleCounts.GYPSY <
    1
  ) {
    required.push(
      "GYPSY"
    );
  }

  if (
    roleCounts.SUPPORT <
    1
  ) {
    required.push(
      "SUPPORT"
    );
  }

  if (
    roleCounts.DPS <
    2
  ) {
    required.push(
      "DPS"
    );
  }

  return required;
}

// =============================================================
// CHOOSE BEST CANDIDATE
// =============================================================

function chooseBestCandidate(
  candidates: RankedMember[],
  currentParty: RankedMember[]
) {
  const jobCounts =
    new Map<
      string,
      number
    >();

  for (
    const member of
      currentParty
  ) {
    const job =
      normalizeJob(
        member.job
      );

    jobCounts.set(
      job,
      (jobCounts.get(
        job
      ) ?? 0) + 1
    );
  }

  return [...candidates].sort(
    (a, b) => {
      const jobA =
        normalizeJob(
          a.job
        );

      const jobB =
        normalizeJob(
          b.job
        );

      const duplicateA =
        jobCounts.get(
          jobA
        ) ?? 0;

      const duplicateB =
        jobCounts.get(
          jobB
        ) ?? 0;

      if (
        duplicateA !==
        duplicateB
      ) {
        return (
          duplicateA -
          duplicateB
        );
      }

      return compareByPercentile(
        a,
        b
      );
    }
  )[0];
}

// =============================================================
// PREFERRED ROLE
// =============================================================

function getPreferredRole(
  member: RankedMember
): PreferredRole {
  const job =
    normalizeJob(
      member.job
    );

  if (
    job === "Priest" ||
    job === "High Priest"
  ) {
    return "PRIEST";
  }

  if (
    job === "Gypsy" ||
    job === "Bard"
  ) {
    return "GYPSY";
  }

  if (
    job ===
      "Biochemist (Plant)" ||
    job ===
      "Doram (Support)"
  ) {
    return "SUPPORT";
  }

  return "DPS";
}

// =============================================================
// COUNT ROLES
// =============================================================

function countRoles(
  members: RankedMember[]
): Record<
  PreferredRole,
  number
> {
  const counts: Record<
    PreferredRole,
    number
  > = {
    PRIEST: 0,
    GYPSY: 0,
    SUPPORT: 0,
    DPS: 0,
  };

  for (
    const member of
      members
  ) {
    counts[
      getPreferredRole(
        member
      )
    ]++;
  }

  return counts;
}

// =============================================================
// COUNT JOBS
// =============================================================

function countJobs(
  members: RankedMember[]
) {
  const counts: Record<
    string,
    number
  > = {};

  for (
    const member of
      members
  ) {
    const job =
      normalizeJob(
        member.job
      ) || "Unknown";

    counts[job] =
      (counts[job] ?? 0) +
      1;
  }

  return counts;
}

// =============================================================
// PERCENTILE COMPARATOR
// =============================================================

function compareByPercentile(
  a: RankedMember,
  b: RankedMember
) {
  if (
    b.guildPercentile !==
    a.guildPercentile
  ) {
    return (
      b.guildPercentile -
      a.guildPercentile
    );
  }

  if (
    b.pvpScore !==
    a.pvpScore
  ) {
    return (
      b.pvpScore -
      a.pvpScore
    );
  }

  return (a.characterName ?? "").localeCompare(b.characterName ?? "");
}

// =============================================================
// METRICS
// =============================================================

function buildMetrics(
  members: RankingMember[]
) {
  return {
    patk: members.map(
      (member) =>
        numberValue(
          member.patk
        )
    ),

    matk: members.map(
      (member) =>
        numberValue(
          member.matk
        )
    ),

    hp: members.map(
      (member) =>
        numberValue(
          member.hp
        )
    ),

    rawPDEF: members.map(
      (member) =>
        numberValue(
          member.pdef
        )
    ),

    rawMDEF: members.map(
      (member) =>
        numberValue(
          member.mdef
        )
    ),

    ignorePDEF:
      members.map(
        (member) =>
          numberValue(
            member.ignorePdef
          )
      ),

    ignoreMDEF:
      members.map(
        (member) =>
          numberValue(
            member.ignoreMdef
          )
      ),

    demiDamage:
      members.map(
        (member) =>
          numberValue(
            member.damageVsDemiHuman
          )
      ),

    demiReduction:
      members.map(
        (member) =>
          numberValue(
            member.damageReductionVsDemiHuman
          )
      ),

    mediumDamage:
      members.map(
        (member) =>
          numberValue(
            member.damageVsMedium
          )
      ),

    mediumReduction:
      members.map(
        (member) =>
          numberValue(
            member.damageReductionVsMedium
          )
      ),

    pdmg: members.map(
      (member) =>
        numberValue(
          member.pdmgPercent
        )
    ),

    mdmg: members.map(
      (member) =>
        numberValue(
          member.mdmgPercent
        )
    ),

    pdmgReduction:
      members.map(
        (member) =>
          numberValue(
            member.pdmgReductionPercent
          )
      ),

    mdmgReduction:
      members.map(
        (member) =>
          numberValue(
            member.mdmgReductionPercent
          )
      ),

    critRes: members.map(
      (member) =>
        numberValue(
          member.critRes
        )
    ),

    pvpBonus:
      members.map(
        (member) =>
          numberValue(
            member.pvpDamageBonus
          )
      ),

    pvpReduction:
      members.map(
        (member) =>
          numberValue(
            member.pvpDamageReduction
          )
      ),
  };
}

// =============================================================
// SCORE CALCULATION
// =============================================================

function calculateScores(
  member: RankingMember,
  metrics: ReturnType<
    typeof buildMetrics
  >
) {
  const tankScore =
    (
      percentile(
        numberValue(
          member.pdef
        ),
        metrics.rawPDEF
      ) * 20 +

      percentile(
        numberValue(
          member.mdef
        ),
        metrics.rawMDEF
      ) * 20 +

      percentile(
        numberValue(
          member.damageReductionVsDemiHuman
        ),
        metrics.demiReduction
      ) * 15 +

      percentile(
        numberValue(
          member.damageReductionVsMedium
        ),
        metrics.mediumReduction
      ) * 15 +

      percentile(
        numberValue(
          member.pdmgReductionPercent
        ),
        metrics.pdmgReduction
      ) * 10 +

      percentile(
        numberValue(
          member.mdmgReductionPercent
        ),
        metrics.mdmgReduction
      ) * 10 +

      percentile(
        numberValue(
          member.critRes
        ),
        metrics.critRes
      ) * 5 +

      percentile(
        numberValue(
          member.pvpDamageReduction
        ),
        metrics.pvpReduction
      ) * 5 +

      percentile(
        numberValue(
          member.hp
        ),
        metrics.hp
      ) * 5
    ) / 105;

  const normalizedClass =
    normalizeJob(
      member.job
    );

  const magicDPS =
    MAGIC_DPS_CLASSES.has(
      normalizedClass
    );

  const usesMATK =
    magicDPS ||
    normalizedClass ===
      "High Priest" ||
    normalizedClass ===
      "Priest";

  const offensiveStatScore =
    usesMATK
      ? percentile(
          numberValue(
            member.matk
          ),
          metrics.matk
        )
      : percentile(
          numberValue(
            member.patk
          ),
          metrics.patk
        );

  const ignoreScore =
    magicDPS
      ? percentile(
          numberValue(
            member.ignoreMdef
          ),
          metrics.ignoreMDEF
        )
      : percentile(
          numberValue(
            member.ignorePdef
          ),
          metrics.ignorePDEF
        );

  const damageScore =
    magicDPS
      ? percentile(
          numberValue(
            member.mdmgPercent
          ),
          metrics.mdmg
        )
      : percentile(
          numberValue(
            member.pdmgPercent
          ),
          metrics.pdmg
        );

  const paladin =
    normalizedClass ===
    "Paladin";

  const dpsScore =
    paladin
      ? (
          ignoreScore * 35 +

          damageScore * 25 +

          offensiveStatScore * 5 +

          percentile(
            numberValue(
              member.pvpDamageBonus
            ),
            metrics.pvpBonus
          ) * 5 +

          percentile(
            numberValue(
              member.pdef
            ),
            metrics.rawPDEF
          ) * 10 +

          percentile(
            numberValue(
              member.mdef
            ),
            metrics.rawMDEF
          ) * 10 +

          percentile(
            numberValue(
              member.damageReductionVsDemiHuman
            ),
            metrics.demiReduction
          ) * 5 +

          percentile(
            numberValue(
              member.damageReductionVsMedium
            ),
            metrics.mediumReduction
          ) * 5 +

          percentile(
            numberValue(
              member.pdmgReductionPercent
            ),
            metrics.pdmgReduction
          ) * 3 +

          percentile(
            numberValue(
              member.mdmgReductionPercent
            ),
            metrics.mdmgReduction
          ) * 3 +

          percentile(
            numberValue(
              member.critRes
            ),
            metrics.critRes
          ) * 2 +

          percentile(
            numberValue(
              member.pvpDamageReduction
            ),
            metrics.pvpReduction
          ) * 2
        ) / 110
      : (
          ignoreScore * 20 +

          percentile(
            numberValue(
              member.damageVsDemiHuman
            ),
            metrics.demiDamage
          ) * 15 +

          percentile(
            numberValue(
              member.damageVsMedium
            ),
            metrics.mediumDamage
          ) * 15 +

          damageScore * 10 +

          offensiveStatScore * 5 +

          percentile(
            numberValue(
              member.pvpDamageBonus
            ),
            metrics.pvpBonus
          ) * 5 +

          percentile(
            numberValue(
              member.pdef
            ),
            metrics.rawPDEF
          ) * 15 +

          percentile(
            numberValue(
              member.mdef
            ),
            metrics.rawMDEF
          ) * 15 +

          percentile(
            numberValue(
              member.damageReductionVsDemiHuman
            ),
            metrics.demiReduction
          ) * 10 +

          percentile(
            numberValue(
              member.damageReductionVsMedium
            ),
            metrics.mediumReduction
          ) * 10 +

          percentile(
            numberValue(
              member.pdmgReductionPercent
            ),
            metrics.pdmgReduction
          ) * 5 +

          percentile(
            numberValue(
              member.mdmgReductionPercent
            ),
            metrics.mdmgReduction
          ) * 5 +

          percentile(
            numberValue(
              member.critRes
            ),
            metrics.critRes
          ) * 3 +

          percentile(
            numberValue(
              member.pvpDamageReduction
            ),
            metrics.pvpReduction
          ) * 2
        ) / 135;

  const isSupport =
    SUPPORT_CLASSES.has(
      normalizedClass
    );

  const pvpScore =
    isSupport
      ? tankScore
      : dpsScore * 0.6 +
        tankScore * 0.4;

  return {
    tankScore,
    dpsScore,
    pvpScore,
  };
}

// =============================================================
// PERCENTILE
// =============================================================

function percentile(
  value: number,
  values: number[]
) {
  const unique =
    [...new Set(values)]
      .sort(
        (a, b) =>
          a - b
      );

  if (
    unique.length <= 1
  ) {
    return 100;
  }

  let lower = 0;

  for (
    const candidate of
      unique
  ) {
    if (
      candidate < value
    ) {
      lower++;
    }
  }

  return (
    lower /
    (unique.length - 1)
  ) * 100;
}

// =============================================================
// HELPERS
// =============================================================

function normalizeJob(
  job: string | null
) {
  return String(
    job ?? ""
  ).trim();
}

function numberValue(
  value: number | null
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return value;
}

// =============================================================
// SUPPORT CLASSES
// =============================================================

const SUPPORT_CLASSES =
  new Set([
    "High Priest",
    "Priest",
    "Bard",
    "Gypsy",
    "Biochemist",
    "Biochemist (Plant)",
    "Doram (Support)",
  ]);

// =============================================================
// MAGIC DPS CLASSES
// =============================================================

const MAGIC_DPS_CLASSES =
  new Set([
    "High Wizard",
    "Professor",
    "Doram (Magic)",
  ]);

// =============================================================
// ROSTER RULES
// =============================================================

function getRosterRules(
  type: EventType
) {
  if (
    type ===
    "GUILD_LEAGUE"
  ) {
    return {
      battlefields: [
        "BATTLEFIELD_1",
        "BATTLEFIELD_2",
      ] as const,

      partiesPerBattlefield:
        8,

      maxMembersPerBattlefield:
        40,
    };
  }

  return {
    battlefields: [
      "BATTLEFIELD_1",
    ] as const,

    partiesPerBattlefield:
      16,

    maxMembersPerBattlefield:
      80,
  };
}

// =============================================================
// EVENT TYPE
// =============================================================

function formatEventType(
  type: EventType
) {
  return type ===
    "GUILD_LEAGUE"
    ? "Guild League"
    : "Emperium Overrun";
}

// =============================================================
// DATE
// =============================================================

function formatDate(
  value: Date
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Asia/Bangkok",

      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(value);
}

// =============================================================
// DELETE ROSTER
// =============================================================

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await getCurrentAuth();

    if (!auth?.user?.id || !auth.guild?.id) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const canEdit = hasPermission(
      auth.role,
      "rosters.edit"
    );

    if (!canEdit) {
      return NextResponse.json(
        { error: "You do not have permission to delete rosters." },
        { status: 403 }
      );
    }

    const { eventId } = await context.params;

    const body = await request.json();

    const rosterId =
      typeof body?.rosterId === "string"
        ? body.rosterId
        : null;

    if (!rosterId) {
      return NextResponse.json(
        { error: "rosterId is required." },
        { status: 400 }
      );
    }

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        guildId: auth.guild.id,
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const roster = await prisma.roster.findFirst({
      where: {
        id: rosterId,
        eventId: event.id,
      },
      select: {
        id: true,
      },
    });

    if (!roster) {
      return NextResponse.json(
        { error: "Roster not found." },
        { status: 404 }
      );
    }

    await prisma.roster.delete({
      where: {
        id: roster.id,
      },
    });

    await notifyRosterUpdate({
      guildId: auth.guild.id,
      eventId,
      rosterId,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[ROSTER DELETE]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete roster.",
      },
      { status: 500 }
    );
  }
}