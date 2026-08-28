import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Battlefield =
  | "BATTLEFIELD_1"
  | "BATTLEFIELD_2";

type PartyRequest = {
  rosterId?: string;
  battlefield?: Battlefield;
  partyNumber?: number;
};

const MAX_PARTY_SIZE = 5;

// =============================================================
// CREATE PARTY
// =============================================================

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as PartyRequest;

    if (!body.rosterId) {
      return NextResponse.json(
        {
          error:
            "Roster ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      body.battlefield !==
        "BATTLEFIELD_1" &&
      body.battlefield !==
        "BATTLEFIELD_2"
    ) {
      return NextResponse.json(
        {
          error:
            "Valid battlefield is required.",
        },
        { status: 400 }
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
        { status: 400 }
      );
    }

    const roster =
      await prisma.roster.findUnique({
        where: {
          id: body.rosterId,
        },

        include: {
          event: true,
          parties: {
            include: {
              members: true,
            },
          },
        },
      });

    if (!roster) {
      return NextResponse.json(
        {
          error:
            "Roster not found.",
        },
        { status: 404 }
      );
    }

    const maxParties =
      roster.event.type ===
      "GUILD_LEAGUE"
        ? 8
        : 16;

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
        { status: 400 }
      );
    }

    if (
      roster.event.type ===
        "EMPERIUM_OVERRUN" &&
      body.battlefield ===
        "BATTLEFIELD_2"
    ) {
      return NextResponse.json(
        {
          error:
            "Emperium Overrun does not have Battlefield 2.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.rosterParty.findUnique({
        where: {
          rosterId_battlefield_partyNumber: {
            rosterId:
              roster.id,
            battlefield:
              body.battlefield,
            partyNumber:
              body.partyNumber,
          },
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "This party already exists.",
        },
        { status: 409 }
      );
    }

    const party =
      await prisma.rosterParty.create({
        data: {
          rosterId:
            roster.id,
          battlefield:
            body.battlefield,
          partyNumber:
            body.partyNumber,
        },
      });

    return NextResponse.json({
      party,
    });
  } catch (error) {
    console.error(
      "[ROSTER PARTIES] Failed to create:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create party.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// DELETE PARTY
// =============================================================

export async function DELETE(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const id =
      url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Party ID is required.",
        },
        { status: 400 }
      );
    }

    const party =
      await prisma.rosterParty.findUnique({
        where: {
          id,
        },
      });

    if (!party) {
      return NextResponse.json(
        {
          error:
            "Party not found.",
        },
        { status: 404 }
      );
    }

    await prisma.rosterParty.delete({
      where: {
        id,
      },
    });

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
          "Failed to delete party.",
      },
      { status: 500 }
    );
  }
}