import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ReservationRequest = {
  id?: string;
  memberId?: string;
  resourceId?: string;
  quantity?: number;
};

async function getGuild() {
  return prisma.guild.findFirst({
    select: {
      id: true,
    },
  });
}

function validateQuantity(
  quantity: unknown
) {
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return "Quantity must be a positive integer.";
  }

  return null;
}

async function getReservationData(
  guildId: string,
  body: ReservationRequest
) {
  if (!body.memberId) {
    return {
      error: "Member is required.",
    };
  }

  if (!body.resourceId) {
    return {
      error: "Resource is required.",
    };
  }

  const quantityError =
    validateQuantity(body.quantity);

  if (quantityError) {
    return {
      error: quantityError,
    };
  }

  const member =
    await prisma.guildMember.findFirst({
      where: {
        id: body.memberId,
        guildId,
      },
    });

  if (!member) {
    return {
      error: "Member not found.",
    };
  }

  const resource =
    await prisma.resource.findFirst({
      where: {
        id: body.resourceId,
        guildId,
      },
    });

  if (!resource) {
    return {
      error: "Resource not found.",
    };
  }

  if (!resource.active) {
    return {
      error:
        "This resource is inactive.",
    };
  }

  // ===========================================================
  // HARD CAP
  // ===========================================================
  //
  // Reservations bypass perPlayerLimit.
  //
  // However, a reserved player can never reserve more than
  // the resource's hardCap.
  //
  // Example:
  //
  // perPlayerLimit = 2
  // hardCap = 5
  //
  // Reservation of 4 -> allowed
  // Reservation of 5 -> allowed
  // Reservation of 6 -> rejected
  //
  // ===========================================================

  if (
    body.quantity! > resource.hardCap
  ) {
    return {
      error:
        `Reservation cannot exceed the ` +
        `hardCap of ${resource.hardCap} ` +
        `for this resource.`,
    };
  }

  // ===========================================================
  // RESOURCE TOTAL
  // ===========================================================
  //
  // A single reservation also cannot exceed the total resource
  // quantity. Normally hardCap <= total, but keep this check as
  // a defensive safeguard.
  //
  // ===========================================================

  if (
    body.quantity! > resource.total
  ) {
    return {
      error:
        "Reservation cannot exceed the resource total.",
    };
  }

  return {
    member,
    resource,
    quantity: body.quantity!,
  };
}

// =============================================================
// CREATE
// =============================================================

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as ReservationRequest;

    const guild = await getGuild();

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured.",
        },
        { status: 404 }
      );
    }

    const data =
      await getReservationData(
        guild.id,
        body
      );

    if ("error" in data) {
      return NextResponse.json(
        data,
        { status: 400 }
      );
    }

    const existing =
      await prisma.reservedAllocation.findUnique(
        {
          where: {
            guildId_memberId_resourceId: {
              guildId: guild.id,
              memberId: data.member.id,
              resourceId: data.resource.id,
            },
          },
        }
      );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "A reservation already exists for this member and resource. Edit the existing reservation instead.",
        },
        { status: 409 }
      );
    }

    const reservation =
      await prisma.reservedAllocation.create(
        {
          data: {
            guildId: guild.id,
            memberId: data.member.id,
            resourceId: data.resource.id,
            quantity: data.quantity,
          },
          include: {
            member: true,
            resource: true,
          },
        }
      );

    return NextResponse.json({
      reservation: {
        id: reservation.id,
        memberId: reservation.memberId,
        resourceId: reservation.resourceId,
        quantity: reservation.quantity,
        memberName:
          reservation.member.displayName,
        resourceName:
          reservation.resource.name,
        resourceType:
          reservation.resource.type,
        resourceTotal:
          reservation.resource.total,
        resourceHardCap:
          reservation.resource.hardCap,
      },
    });
  } catch (error) {
    console.error(
      "[RESERVATIONS] Failed to create reservation:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create reservation.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// UPDATE
// =============================================================

export async function PUT(
  request: Request
) {
  try {
    const body =
      (await request.json()) as ReservationRequest;

    if (!body.id) {
      return NextResponse.json(
        {
          error:
            "Reservation ID is required.",
        },
        { status: 400 }
      );
    }

    const guild = await getGuild();

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured.",
        },
        { status: 404 }
      );
    }

    const existing =
      await prisma.reservedAllocation.findFirst(
        {
          where: {
            id: body.id,
            guildId: guild.id,
          },
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Reservation not found.",
        },
        { status: 404 }
      );
    }

    const data =
      await getReservationData(
        guild.id,
        body
      );

    if ("error" in data) {
      return NextResponse.json(
        data,
        { status: 400 }
      );
    }

    const duplicate =
      await prisma.reservedAllocation.findFirst(
        {
          where: {
            guildId: guild.id,
            memberId: data.member.id,
            resourceId: data.resource.id,
            NOT: {
              id: body.id,
            },
          },
        }
      );

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "A reservation already exists for this member and resource.",
        },
        { status: 409 }
      );
    }

    const reservation =
      await prisma.reservedAllocation.update(
        {
          where: {
            id: body.id,
          },
          data: {
            memberId: data.member.id,
            resourceId: data.resource.id,
            quantity: data.quantity,
          },
          include: {
            member: true,
            resource: true,
          },
        }
      );

    return NextResponse.json({
      reservation: {
        id: reservation.id,
        memberId: reservation.memberId,
        resourceId: reservation.resourceId,
        quantity: reservation.quantity,
        memberName:
          reservation.member.displayName,
        resourceName:
          reservation.resource.name,
        resourceType:
          reservation.resource.type,
        resourceTotal:
          reservation.resource.total,
        resourceHardCap:
          reservation.resource.hardCap,
      },
    });
  } catch (error) {
    console.error(
      "[RESERVATIONS] Failed to update reservation:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update reservation.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// DELETE
// =============================================================

export async function DELETE(
  request: Request
) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Reservation ID is required.",
        },
        { status: 400 }
      );
    }

    const guild = await getGuild();

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured.",
        },
        { status: 404 }
      );
    }

    const existing =
      await prisma.reservedAllocation.findFirst(
        {
          where: {
            id,
            guildId: guild.id,
          },
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Reservation not found.",
        },
        { status: 404 }
      );
    }

    await prisma.reservedAllocation.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[RESERVATIONS] Failed to delete reservation:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete reservation.",
      },
      { status: 500 }
    );
  }
}