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

type Battlefield = | "BATTLEFIELD_1"
  | "BATTLEFIELD_2"
  | "BATTLEFIELD_3"
  | "BATTLEFIELD_4"
  | "BATTLEFIELD_5"
  | "BATTLEFIELD_6"
  | "BATTLEFIELD_7"
  | "BATTLEFIELD_8"
  | "BATTLEFIELD_9"
  | "BATTLEFIELD_10"
  | "BATTLEFIELD_11"
  | "BATTLEFIELD_12"
  | "BATTLEFIELD_13"
  | "BATTLEFIELD_14"
  | "BATTLEFIELD_15"
  | "BATTLEFIELD_16"
  | "BATTLEFIELD_17"
  | "BATTLEFIELD_18"
  | "BATTLEFIELD_19"
  | "BATTLEFIELD_20";

type PartyRequest = {
  rosterId?: string;
  battlefield?: Battlefield;
  partyNumber?: number;
};

const MAX_PARTY_SIZE = 5;

// =============================================================
// POST
// Create a party
// =============================================================

export async function POST(
  request: Request
) {
  try {
    // ---------------------------------------------------------
    // AUTHENTICATION
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // PERMISSION
    // ---------------------------------------------------------

    if (
      !hasPermission(
        auth.role,
        "rosters.edit"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to edit rosters.",
        },
        {
          status: 403,
        }
      );
    }

    // ---------------------------------------------------------
    // REQUEST BODY
    // ---------------------------------------------------------

    const body =
      (await request.json()) as PartyRequest;

    if (!body.rosterId) {
      return NextResponse.json(
        {
          error:
            "Roster ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof body.battlefield !== "string" ||
      !/^BATTLEFIELD_(?:[1-9]|1[0-9]|20)$/.test(body.battlefield)
    ) {
      return NextResponse.json(
        {
          error:
            "Valid battlefield is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof body.partyNumber !==
        "number" ||
      !Number.isInteger(
        body.partyNumber
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Party number must be an integer.",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD ROSTER
    // ---------------------------------------------------------
    //
    // The roster itself does not have a guildId.
    // Its event does.
    //
    // Therefore authorization must follow:
    //
    // roster -> event -> guildId
    //
    // ---------------------------------------------------------

    const roster =
      await prisma.roster.findUnique(
        {
          where: {
            id:
              body.rosterId,
          },

          include: {
            event: true,

            parties: {
              include: {
                members: true,
              },
            },
          },
        }
      );

    if (!roster) {
      return NextResponse.json(
        {
          error:
            "Roster not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // GUILD ISOLATION
    // ---------------------------------------------------------

    if (
      roster.event.guildId !==
      auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Roster not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // EVENT LIMITS
    // ---------------------------------------------------------

    const isCustomRo3 = roster.event.type === "RO3_CUSTOM";
    const maxParties = isCustomRo3 ? roster.event.partiesPerBattlefield ?? 0 : roster.event.type === "GUILD_LEAGUE" ? 8 : 16;
    const maxBattlefields = isCustomRo3 ? roster.event.battlefieldCount ?? 0 : roster.event.type === "GUILD_LEAGUE" ? 2 : 1;

    if (
      body.partyNumber < 1 ||
      body.partyNumber >
        maxParties
    ) {
      return NextResponse.json(
        {
          error:
            `Party number must be between 1 and ${maxParties}.`,
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // BATTLEFIELD VALIDATION
    // ---------------------------------------------------------

    const battlefieldNumber = Number(body.battlefield.replace("BATTLEFIELD_", ""));
    if (battlefieldNumber > maxBattlefields) {
      return NextResponse.json(
        {
          error:
            "This event type does not have that battlefield.",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // DUPLICATE PARTY
    // ---------------------------------------------------------

    const existing =
      await prisma.rosterParty.findUnique(
        {
          where: {
            rosterId_battlefield_partyNumber:
              {
                rosterId:
                  roster.id,

                battlefield:
                  body.battlefield,

                partyNumber:
                  body.partyNumber,
              },
          },
        }
      );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "This party already exists.",
        },
        {
          status: 409,
        }
      );
    }

    // ---------------------------------------------------------
    // CREATE PARTY
    // ---------------------------------------------------------

    const party =
      await prisma.rosterParty.create(
        {
          data: {
            rosterId:
              roster.id,

            battlefield:
              body.battlefield,

            partyNumber:
              body.partyNumber,
          },
        }
      );

    return NextResponse.json(
      {
        party,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("[ROSTER PARTIES] Failed to create:", error);
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "This party already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create party." },
      { status: 500 }
    );
  }
}

// =============================================================
// DELETE
// Delete a party
// =============================================================

export async function DELETE(
  request: Request
) {
  try {
    // ---------------------------------------------------------
    // AUTHENTICATION
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // PERMISSION
    // ---------------------------------------------------------

    if (
      !hasPermission(
        auth.role,
        "rosters.edit"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to edit rosters.",
        },
        {
          status: 403,
        }
      );
    }

    // ---------------------------------------------------------
    // PARTY ID
    // ---------------------------------------------------------

    const url =
      new URL(request.url);

    const id =
      url.searchParams.get(
        "id"
      );

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Party ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // LOAD PARTY + GUILD
    // ---------------------------------------------------------

    const party =
      await prisma.rosterParty.findUnique(
        {
          where: {
            id,
          },

          include: {
            roster: {
              include: {
                event: true,
              },
            },
          },
        }
      );

    if (!party) {
      return NextResponse.json(
        {
          error:
            "Party not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // GUILD ISOLATION
    // ---------------------------------------------------------

    if (
      party.roster.event.guildId !==
      auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Party not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // DELETE
    // ---------------------------------------------------------

    await prisma.rosterParty.delete(
      {
        where: {
          id,
        },
      }
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[ROSTER PARTIES] Failed to delete:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete party.",
      },
      {
        status: 500,
      }
    );
  }
}