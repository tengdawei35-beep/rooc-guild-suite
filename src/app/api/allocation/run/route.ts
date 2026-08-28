import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  buildAllocation,
} from "@/lib/allocation/engine";

type RunRequest = {
  eventId?: string;
  nonReservedMemberCount?: number;
};

type BidSlotData = {
  memberId: string;
  resourceId: string;
};

const SLOTS_PER_PAGE = 4;

export async function POST(
  request: Request
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
    //
    // Running an allocation creates persistent allocation data,
    // bid pages and changes rotation state.
    //
    // Therefore this requires allocation.run.
    //
    // ==========================================================

    if (
      !hasPermission(
        auth.role,
        "allocation.run"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to run an allocation.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as RunRequest;

    const eventId =
      body.eventId;

    const nonReservedMemberCount =
      body.nonReservedMemberCount;

    // ==========================================================
    // VALIDATE INPUT
    // ==========================================================

    if (
      typeof eventId !== "string" ||
      eventId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "An event must be selected before running an allocation.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof nonReservedMemberCount !==
        "number" ||
      !Number.isInteger(
        nonReservedMemberCount
      ) ||
      nonReservedMemberCount < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Number of non-reserved members must be a non-negative integer.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // LOAD EVENT
    // ==========================================================
    //
    // IMPORTANT:
    //
    // Scope the event to the authenticated guild.
    //
    // findUnique({ id }) would allow an authenticated user to
    // select another guild's event.
    //
    // ==========================================================

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,

          guildId:
            auth.guild.id,
        },

        include: {
          guild: {
            select: {
              id: true,
              name: true,
            },
          },
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

    // ==========================================================
    // BUILD THE ALLOCATION
    // ==========================================================

    const preview =
      await buildAllocation({
        guildId:
         auth.guild.id,
        nonReservedMemberCount,

        eventDate:
          event.date,
      });

    // ==========================================================
    // VERIFY EVENT / GUILD
    // ==========================================================
    //
    // The event was already scoped to auth.guild.id.
    //
    // Keep this second check because the allocation engine
    // independently determines which guild is being allocated.
    //
    // ==========================================================

    if (
      preview.guildId !==
      auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Allocation does not belong to your guild.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      preview.guildId !==
      event.guildId
    ) {
      return NextResponse.json(
        {
          error:
            "Event does not belong to the configured guild.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // LOAD GUILD + ROTATION STATES
    // ==========================================================

    const guild =
      await prisma.guild.findUnique({
        where: {
          id:
            preview.guildId,
        },

        include: {
          resources: {
            where: {
              active: true,
            },

            include: {
              rotationStates: true,
            },
          },
        },
      });

    if (!guild) {
      throw new Error(
        "Guild no longer exists."
      );
    }

    // ==========================================================
    // EVENT DATE RANGE
    // ==========================================================
    //
    // Event dates are stored as UTC+7 midnight.
    //
    // Example:
    //
    // 2026-09-01 00:00 UTC+7
    // =
    // 2026-08-31 17:00 UTC
    //
    // Therefore a 24-hour range from event.date represents
    // the complete event calendar date in UTC+7.
    //
    // ==========================================================

    const eventDateStart =
      new Date(event.date);

    const eventDateEnd =
      new Date(
        eventDateStart.getTime() +
          24 * 60 * 60 * 1000
      );

    // ==========================================================
    // DETERMINE ROTATION BEFORE / AFTER
    // ==========================================================

    const rotationBefore: Record<
      string,
      number
    > = {};

    const rotationAfter: Record<
      string,
      number
    > = {};

    for (
      const resource of
        guild.resources
    ) {
      const currentIndex =
        resource
          .rotationStates[0]
          ?.rotationIndex ??
        0;

      rotationBefore[
        resource.id
      ] =
        currentIndex;

      const resourceResult =
        preview.resources.find(
          (result) =>
            result.resourceId ===
            resource.id
        );

      const selectedCount =
        resourceResult
          ?.selectedMembers
          .length ??
        0;

      // --------------------------------------------------------
      // COUNT THE SAME MEMBER POOL USED BY THE ENGINE
      // --------------------------------------------------------
      //
      // A member must:
      //
      // - belong to this guild
      // - be active
      // - be eligible for bidding
      // - NOT be on leave for the event date
      // - NOT have a reservation for this resource
      //
      // This keeps rotation calculations consistent with
      // the allocation engine.
      //
      // --------------------------------------------------------

      const eligibleMemberCount =
        await prisma.guildMember.count(
          {
            where: {
              guildId:
                preview.guildId,

              active: true,

              eligible: true,

              leaveDates: {
                none: {
                  date: {
                    gte:
                      eventDateStart,

                    lt:
                      eventDateEnd,
                  },
                },
              },

              NOT: {
                reservations: {
                  some: {
                    resourceId:
                      resource.id,
                  },
                },
              },
            },
          }
        );

      const nextIndex =
        eligibleMemberCount >
        0
          ? (
              currentIndex +
              selectedCount
            ) %
            eligibleMemberCount
          : 0;

      rotationAfter[
        resource.id
      ] =
        nextIndex;
    }

    // ==========================================================
    // BUILD BID SLOT DATA
    // ==========================================================

    const bidSlotsByType: Record<
      "FEATHER" | "CARD",
      BidSlotData[]
    > = {
      FEATHER: [],
      CARD: [],
    };

    for (
      const resource of
        preview.resources
    ) {
      const type =
        resource.type;

      for (
        const assignment of
          resource.assignments
      ) {
        const quantity =
          assignment.reservedQuantity +
          assignment.assignedQuantity;

        if (
          quantity <= 0
        ) {
          continue;
        }

        for (
          let i = 0;
          i < quantity;
          i++
        ) {
          bidSlotsByType[
            type
          ].push({
            memberId:
              assignment.memberId,

            resourceId:
              assignment.resourceId,
          });
        }
      }
    }

    // ==========================================================
    // PERSIST EVERYTHING IN ONE TRANSACTION
    // ==========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ----------------------------------------------------
          // CREATE ALLOCATION RUN
          // ----------------------------------------------------

          const run =
            await tx.allocationRun.create(
              {
                data: {
                  guildId:
                    preview.guildId,

                  eventId:
                    event.id,

                  status:
                    "RUNNING",

                  rotationIndexBefore:
                    rotationBefore,
                },
              }
            );

          // ----------------------------------------------------
          // SAVE RESOURCE RESULTS
          // ----------------------------------------------------

          for (
            const resource of
              preview.resources
          ) {
            await tx.resourceResult.create(
              {
                data: {
                  allocationRunId:
                    run.id,

                  resourceId:
                    resource.resourceId,

                  total:
                    resource.total,

                  reserved:
                    resource.reserved,

                  allocated:
                    resource.allocated,

                  overflow:
                    resource.overflow,
                },
              }
            );
          }

          // ----------------------------------------------------
          // SAVE MEMBER ALLOCATIONS
          // ----------------------------------------------------

          for (
            const resource of
              preview.resources
          ) {
            for (
              const assignment of
                resource.assignments
            ) {
              if (
                assignment.reservedQuantity ===
                  0 &&
                assignment.assignedQuantity ===
                  0
              ) {
                continue;
              }

              await tx.allocationResult.create(
                {
                  data: {
                    allocationRunId:
                      run.id,

                    memberId:
                      assignment.memberId,

                    resourceId:
                      assignment.resourceId,

                    reservedQuantity:
                      assignment.reservedQuantity,

                    assignedQuantity:
                      assignment.assignedQuantity,
                  },
                }
              );
            }
          }

          // ----------------------------------------------------
          // CREATE BID PAGES
          // ----------------------------------------------------

          for (
            const type of [
              "FEATHER",
              "CARD",
            ] as const
          ) {
            const slots =
              bidSlotsByType[
                type
              ];

            if (
              slots.length ===
              0
            ) {
              continue;
            }

            const pageCount =
              Math.ceil(
                slots.length /
                  SLOTS_PER_PAGE
              );

            for (
              let pageNumber = 1;
              pageNumber <=
              pageCount;
              pageNumber++
            ) {
              const startIndex =
                (pageNumber -
                  1) *
                SLOTS_PER_PAGE;

              const pageSlots =
                slots.slice(
                  startIndex,
                  startIndex +
                    SLOTS_PER_PAGE
                );

              const bidPage =
                await tx.bidPage.create(
                  {
                    data: {
                      allocationRunId:
                        run.id,

                      type,

                      pageNumber,
                    },
                  }
                );

              for (
                let index = 0;
                index <
                pageSlots.length;
                index++
              ) {
                const slot =
                  pageSlots[
                    index
                  ];

                await tx.bidSlot.create(
                  {
                    data: {
                      bidPageId:
                        bidPage.id,

                      slotNumber:
                        index + 1,

                      resourceId:
                        slot.resourceId,

                      memberId:
                        slot.memberId,
                    },
                  }
                );
              }
            }
          }

          // ----------------------------------------------------
          // UPDATE ROTATION STATES
          // ----------------------------------------------------

          for (
            const resource of
              guild.resources
          ) {
            const rotationIndex =
              rotationAfter[
                resource.id
              ] ?? 0;

            await tx.rotationState.upsert(
              {
                where: {
                  guildId_resourceId:
                    {
                      guildId:
                        preview.guildId,

                      resourceId:
                        resource.id,
                    },
                },

                create: {
                  guildId:
                    preview.guildId,

                  resourceId:
                    resource.id,

                  rotationIndex,
                },

                update: {
                  rotationIndex,
                },
              }
            );
          }

          // ----------------------------------------------------
          // COMPLETE RUN
          // ----------------------------------------------------

          return tx.allocationRun.update(
            {
              where: {
                id:
                  run.id,
              },

              data: {
                status:
                  "COMPLETED",

                rotationIndexAfter:
                  rotationAfter,

                completedAt:
                  new Date(),
              },
            }
          );
        }
      );

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return NextResponse.json({
      success: true,

      allocationRun: {
        id:
          result.id,

        status:
          result.status,

        createdAt:
          result.createdAt,

        completedAt:
          result.completedAt,

        eventId:
          event.id,
      },

      event: {
        id:
          event.id,

        type:
          event.type,

        date:
          event.date,
      },

      rotation: {
        before:
          rotationBefore,

        after:
          rotationAfter,
      },

      bidPages: {
        feathers:
          Math.ceil(
            bidSlotsByType
              .FEATHER
              .length /
              SLOTS_PER_PAGE
          ),

        cards:
          Math.ceil(
            bidSlotsByType
              .CARD
              .length /
              SLOTS_PER_PAGE
          ),

        totalSlots:
          bidSlotsByType
            .FEATHER
            .length +
          bidSlotsByType
            .CARD
            .length,
      },

      preview,
    });
  } catch (error) {
    console.error(
      "[ALLOCATION] Failed to run allocation:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run allocation.",
      },
      {
        status: 500,
      }
    );
  }
}