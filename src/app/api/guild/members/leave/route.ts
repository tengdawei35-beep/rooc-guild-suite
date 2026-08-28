import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

type LeaveRequest = {
  id?: string;
  memberId?: string;
  date?: string;
  reason?: string | null;
};

function normalizeDate(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00.000Z`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

// =============================================================
// CREATE
// =============================================================

export async function POST(
  request: Request
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

    const body =
      (await request.json()) as LeaveRequest;

    if (!body.memberId) {
      return NextResponse.json(
        {
          error:
            "Member ID is required.",
        },
        { status: 400 }
      );
    }

    if (!body.date) {
      return NextResponse.json(
        {
          error:
            "Leave date is required.",
        },
        { status: 400 }
      );
    }

    const date =
      normalizeDate(
        body.date
      );

    if (!date) {
      return NextResponse.json(
        {
          error:
            "Invalid leave date.",
        },
        { status: 400 }
      );
    }

    const member =
      await prisma.guildMember.findFirst(
        {
          where: {
            id:
              body.memberId,

            guildId:
              auth.guild.id,
          },
        }
      );

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Member not found.",
        },
        { status: 404 }
      );
    }

    const canManageAny =
      hasPermission(
        auth.role,
        "leave.manageAny"
      );

    const isOwnMember =
      member.userId !== null &&
      member.userId ===
        auth.user.id;

    const canManageOwn =
      hasPermission(
        auth.role,
        "leave.manageOwn"
      ) && isOwnMember;

    if (
      !canManageAny &&
      !canManageOwn
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage this member's unavailable dates.",
        },
        { status: 403 }
      );
    }

    const existing =
      await prisma.memberLeave.findUnique(
        {
          where: {
            memberId_date: {
              memberId:
                member.id,

              date,
            },
          },
        }
      );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "This member is already marked unavailable on this date.",
        },
        { status: 409 }
      );
    }

    const leave =
      await prisma.memberLeave.create(
        {
          data: {
            memberId:
              member.id,

            date,

            reason:
              body.reason?.trim() ||
              null,
          },
        }
      );

    return NextResponse.json({
      leave: {
        id:
          leave.id,

        memberId:
          leave.memberId,

        date:
          leave.date.toISOString(),

        reason:
          leave.reason,
      },
    });
  } catch (error) {
    console.error(
      "[MEMBER LEAVE] Failed to create leave date:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create unavailable date.",
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

    const body =
      (await request.json()) as LeaveRequest;

    if (!body.id) {
      return NextResponse.json(
        {
          error:
            "Leave ID is required.",
        },
        { status: 400 }
      );
    }

    if (!body.date) {
      return NextResponse.json(
        {
          error:
            "Leave date is required.",
        },
        { status: 400 }
      );
    }

    const date =
      normalizeDate(
        body.date
      );

    if (!date) {
      return NextResponse.json(
        {
          error:
            "Invalid leave date.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.memberLeave.findUnique(
        {
          where: {
            id:
              body.id,
          },

          include: {
            member: true,
          },
        }
      );

    if (
      !existing ||
      existing.member.guildId !==
        auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Unavailable date not found.",
        },
        { status: 404 }
      );
    }

    const canManageAny =
      hasPermission(
        auth.role,
        "leave.manageAny"
      );

    const isOwnMember =
      existing.member.userId !== null &&
      existing.member.userId ===
        auth.user.id;

    const canManageOwn =
      hasPermission(
        auth.role,
        "leave.manageOwn"
      ) && isOwnMember;

    if (
      !canManageAny &&
      !canManageOwn
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage this unavailable date.",
        },
        { status: 403 }
      );
    }

    const duplicate =
      await prisma.memberLeave.findFirst(
        {
          where: {
            memberId:
              existing.memberId,

            date,

            NOT: {
              id:
                body.id,
            },
          },
        }
      );

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "This member is already marked unavailable on this date.",
        },
        { status: 409 }
      );
    }

    const leave =
      await prisma.memberLeave.update(
        {
          where: {
            id:
              body.id,
          },

          data: {
            date,

            reason:
              body.reason?.trim() ||
              null,
          },
        }
      );

    return NextResponse.json({
      leave: {
        id:
          leave.id,

        memberId:
          leave.memberId,

        date:
          leave.date.toISOString(),

        reason:
          leave.reason,
      },
    });
  } catch (error) {
    console.error(
      "[MEMBER LEAVE] Failed to update leave date:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update unavailable date.",
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
            "Leave ID is required.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.memberLeave.findUnique(
        {
          where: {
            id,
          },

          include: {
            member: true,
          },
        }
      );

    if (
      !existing ||
      existing.member.guildId !==
        auth.guild.id
    ) {
      return NextResponse.json(
        {
          error:
            "Unavailable date not found.",
        },
        { status: 404 }
      );
    }

    const canManageAny =
      hasPermission(
        auth.role,
        "leave.manageAny"
      );

    const isOwnMember =
      existing.member.userId !== null &&
      existing.member.userId ===
        auth.user.id;

    const canManageOwn =
      hasPermission(
        auth.role,
        "leave.manageOwn"
      ) && isOwnMember;

    if (
      !canManageAny &&
      !canManageOwn
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to remove this unavailable date.",
        },
        { status: 403 }
      );
    }

    await prisma.memberLeave.delete(
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
      "[MEMBER LEAVE] Failed to delete leave date:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to remove unavailable date.",
      },
      { status: 500 }
    );
  }
}