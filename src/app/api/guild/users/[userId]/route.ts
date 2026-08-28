import { NextResponse } from "next/server";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  canManageRole,
  canManageTarget,
  hasPermission,
  USER_ROLES,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

type UserRole =
  (typeof USER_ROLES)[number];

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    typeof value === "string" &&
    USER_ROLES.includes(
      value as UserRole
    )
  );
}

// =============================================================
// PATCH
// Change a user's guild role
// =============================================================

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      userId: string;
    }>;
  }
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
        {
          status: 401,
        }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "users.manage"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage users.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      userId,
    } = await context.params;

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "User ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      userId === auth.user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot change your own guild role.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const newRole =
      body.role;

    if (
      !isUserRole(newRole)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid role.",
        },
        {
          status: 400,
        }
      );
    }

    const membership =
      await prisma.guildMembership.findUnique(
        {
          where: {
            userId_guildId: {
              userId,
              guildId:
                auth.guild.id,
            },
          },

          include: {
            user: true,
          },
        }
      );

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "User does not have access to this guild.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // Check whether the authenticated user may change this
    // specific user's role.
    //
    // This checks BOTH:
    //
    //   1. The current role of the target
    //   2. The requested new role
    //
    // ---------------------------------------------------------

    if (
      !canManageRole(
        auth.role,
        membership.role,
        newRole
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to assign this role.",
        },
        {
          status: 403,
        }
      );
    }

    // ---------------------------------------------------------
    // Prevent removing the last ADMIN
    // ---------------------------------------------------------

    if (
      membership.role === "ADMIN" &&
      newRole !== "ADMIN"
    ) {
      const adminCount =
        await prisma.guildMembership.count(
          {
            where: {
              guildId:
                auth.guild.id,

              role:
                "ADMIN",
            },
          }
        );

      if (
        adminCount <= 1
      ) {
        return NextResponse.json(
          {
            error:
              "The guild must have at least one ADMIN.",
          },
          {
            status: 409,
          }
        );
      }
    }

    const updated =
      await prisma.guildMembership.update(
        {
          where: {
            userId_guildId: {
              userId,
              guildId:
                auth.guild.id,
            },
          },

          data: {
            role:
              newRole,
          },

          include: {
            user: true,
          },
        }
      );

    return NextResponse.json({
      user: {
        id:
          updated.user.id,

        membershipId:
          updated.id,

        discordId:
          updated.user
            .discordId,

        username:
          updated.user
            .username,

        avatarUrl:
          updated.user
            .avatarUrl,

        role:
          updated.role,
      },
    });
  } catch (error) {
    console.error(
      "[GUILD USERS PATCH]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update user.",
      },
      {
        status: 500,
      }
    );
  }
}

// =============================================================
// DELETE
// Remove a user's access to the current guild
// =============================================================

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      userId: string;
    }>;
  }
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
        {
          status: 401,
        }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "users.manage"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage users.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      userId,
    } = await context.params;

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "User ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      userId === auth.user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot remove your own guild access.",
        },
        {
          status: 403,
        }
      );
    }

    const membership =
      await prisma.guildMembership.findUnique(
        {
          where: {
            userId_guildId: {
              userId,
              guildId:
                auth.guild.id,
            },
          },

          include: {
            user: true,
          },
        }
      );

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "User does not have access to this guild.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // Removing access is not a role change.
    //
    // Use canManageTarget() rather than canManageRole().
    // ---------------------------------------------------------

    if (
      !canManageTarget(
        auth.role,
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to remove this user.",
        },
        {
          status: 403,
        }
      );
    }

    // ---------------------------------------------------------
    // Prevent removal of the last ADMIN
    // ---------------------------------------------------------

    if (
      membership.role === "ADMIN"
    ) {
      const adminCount =
        await prisma.guildMembership.count(
          {
            where: {
              guildId:
                auth.guild.id,

              role:
                "ADMIN",
            },
          }
        );

      if (
        adminCount <= 1
      ) {
        return NextResponse.json(
          {
            error:
              "The guild must have at least one ADMIN.",
          },
          {
            status: 409,
          }
        );
      }
    }

    await prisma.guildMembership.delete(
      {
        where: {
          userId_guildId: {
            userId,
            guildId:
              auth.guild.id,
          },
        },
      }
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[GUILD USERS DELETE]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to remove user.",
      },
      {
        status: 500,
      }
    );
  }
}