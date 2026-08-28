import { NextResponse } from "next/server";

import {
  getCurrentAuth,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

type UserRole =
  | "LEADER"
  | "COUNCIL"
  | "OFFICER"
  | "MEMBER";

const VALID_ROLES: UserRole[] = [
  "LEADER",
  "COUNCIL",
  "OFFICER",
  "MEMBER",
];

// =============================================================
// PERMISSION HELPERS
// =============================================================

function canManageTarget(
  actorRole: UserRole,
  targetRole: UserRole,
  newRole?: UserRole
): boolean {
  // LEADER can manage everyone.
  if (actorRole === "LEADER") {
    return true;
  }

  // Only LEADER and OFFICER can
  // manage users.
  if (actorRole !== "OFFICER") {
    return false;
  }

  // OFFICER cannot modify LEADER
  // or COUNCIL accounts.
  if (
    targetRole === "LEADER" ||
    targetRole === "COUNCIL"
  ) {
    return false;
  }

  // OFFICER can only assign
  // MEMBER or OFFICER.
  if (
    newRole &&
    newRole !== "MEMBER" &&
    newRole !== "OFFICER"
  ) {
    return false;
  }

  return true;
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
    // ---------------------------------------------------------
    // Authentication
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
    // Permission
    // ---------------------------------------------------------

    if (
      auth.role !== "LEADER" &&
      auth.role !== "OFFICER"
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

    // ---------------------------------------------------------
    // Target user
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // Prevent self-role changes
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // Request body
    // ---------------------------------------------------------

    const body =
      await request.json();

    const role =
      body.role as UserRole;

    if (
      !VALID_ROLES.includes(role)
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

    // ---------------------------------------------------------
    // Find membership within CURRENT guild
    // ---------------------------------------------------------

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
    // Check target role permissions
    // ---------------------------------------------------------

    if (
      !canManageTarget(
        auth.role,
        membership.role,
        role
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
    // Prevent removal of the last LEADER
    // ---------------------------------------------------------

    if (
      membership.role === "LEADER" &&
      role !== "LEADER"
    ) {
      const leaderCount =
        await prisma.guildMembership.count(
          {
            where: {
              guildId:
                auth.guild.id,

              role: "LEADER",
            },
          }
        );

      if (
        leaderCount <= 1
      ) {
        return NextResponse.json(
          {
            error:
              "The guild must have at least one LEADER.",
          },
          {
            status: 409,
          }
        );
      }
    }

    // ---------------------------------------------------------
    // Update membership
    // ---------------------------------------------------------

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
            role,
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
    // ---------------------------------------------------------
    // Authentication
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
    // Permission
    // ---------------------------------------------------------

    if (
      auth.role !== "LEADER" &&
      auth.role !== "OFFICER"
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

    // ---------------------------------------------------------
    // Target user
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // Prevent self-removal
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // Find membership within CURRENT guild
    // ---------------------------------------------------------

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
    // Check target role permissions
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
    // Prevent removal of the last LEADER
    // ---------------------------------------------------------

    if (
      membership.role === "LEADER"
    ) {
      const leaderCount =
        await prisma.guildMembership.count(
          {
            where: {
              guildId:
                auth.guild.id,

              role: "LEADER",
            },
          }
        );

      if (
        leaderCount <= 1
      ) {
        return NextResponse.json(
          {
            error:
              "The guild must have at least one LEADER.",
          },
          {
            status: 409,
          }
        );
      }
    }

    // ---------------------------------------------------------
    // Remove guild membership ONLY
    // ---------------------------------------------------------

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