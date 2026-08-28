import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = [
  "FEATHER",
  "CARD",
] as const;

type ResourceType =
  (typeof VALID_TYPES)[number];

type ResourceRequest = {
  id?: string;
  name?: string;
  type?: ResourceType;
  total?: number;
  perPlayerLimit?: number;
  hardCap?: number;
  active?: boolean;
};

async function getGuild() {
  return prisma.guild.findFirst({
    select: {
      id: true,
    },
  });
}

function validateResourceData(
  body: ResourceRequest
) {
  const name = body.name?.trim();

  if (!name) {
    return {
      error: "Resource name is required.",
    };
  }

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type)
  ) {
    return {
      error:
        "A valid resource type is required.",
    };
  }

  if (
    typeof body.total !== "number" ||
    !Number.isInteger(body.total) ||
    body.total < 0
  ) {
    return {
      error:
        "Total quantity must be a non-negative integer.",
    };
  }

  if (
    typeof body.perPlayerLimit !==
      "number" ||
    !Number.isInteger(
      body.perPlayerLimit
    ) ||
    body.perPlayerLimit < 1
  ) {
    return {
      error:
        "Per-player limit must be a positive integer.",
    };
  }

  if (
    typeof body.hardCap !== "number" ||
    !Number.isInteger(body.hardCap) ||
    body.hardCap < 1
  ) {
    return {
      error:
        "Hard cap must be a positive integer.",
    };
  }

  if (body.perPlayerLimit > body.hardCap) {
    return {
      error:
        "Per-player limit cannot exceed the hard cap.",
    };
  }

  if (body.hardCap > body.total) {
    return {
      error:
        "Hard cap cannot exceed total quantity.",
    };
  }  

  if (
    body.perPlayerLimit > body.total &&
    body.total > 0
  ) {
    return {
      error:
        "Per-player limit cannot exceed total quantity.",
    };
  }

  return {
    name,
    type: body.type,
    total: body.total,
    perPlayerLimit:
      body.perPlayerLimit,
    hardCap: body.hardCap,
    active: body.active ?? true,
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
      (await request.json()) as ResourceRequest;

    const data =
      validateResourceData(body);

    if ("error" in data) {
      return NextResponse.json(
        data,
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
      await prisma.resource.findUnique({
        where: {
          guildId_name: {
            guildId: guild.id,
            name: data.name,
          },
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "A resource with this name already exists.",
        },
        { status: 409 }
      );
    }

    const resource =
      await prisma.resource.create({
        data: {
          guildId: guild.id,
          name: data.name,
          type: data.type,
          total: data.total,
          perPlayerLimit:
            data.perPlayerLimit,
          hardCap: data.hardCap,
          active: data.active,
        },
      });

    return NextResponse.json({
      resource,
    });
  } catch (error) {
    console.error(
      "[RESOURCES] Failed to create resource:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create resource.",
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
      (await request.json()) as ResourceRequest;

    if (!body.id) {
      return NextResponse.json(
        {
          error:
            "Resource ID is required.",
        },
        { status: 400 }
      );
    }

    const data =
      validateResourceData(body);

    if ("error" in data) {
      return NextResponse.json(
        data,
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
      await prisma.resource.findFirst({
        where: {
          id: body.id,
          guildId: guild.id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Resource not found.",
        },
        { status: 404 }
      );
    }

    const duplicate =
      await prisma.resource.findFirst({
        where: {
          guildId: guild.id,
          name: data.name,
          NOT: {
            id: body.id,
          },
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "A resource with this name already exists.",
        },
        { status: 409 }
      );
    }

    const resource =
      await prisma.resource.update({
        where: {
          id: body.id,
        },
        data: {
          name: data.name,
          type: data.type,
          total: data.total,
          perPlayerLimit:
            data.perPlayerLimit,
          hardCap: data.hardCap,
          active: data.active,
        },
      });

    return NextResponse.json({
      resource,
    });
  } catch (error) {
    console.error(
      "[RESOURCES] Failed to update resource:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update resource.",
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
            "Resource ID is required.",
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
      await prisma.resource.findFirst({
        where: {
          id,
          guildId: guild.id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Resource not found.",
        },
        { status: 404 }
      );
    }

    await prisma.resource.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[RESOURCES] Failed to delete resource:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete resource.",
      },
      { status: 500 }
    );
  }
}