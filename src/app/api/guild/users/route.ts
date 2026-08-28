import { NextResponse } from "next/server";

import {
  getCurrentAuth,
} from "@/lib/auth";

import {
  canManageRole,
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
// GET
// =============================================================
//
// ADMIN   -> all users
// MANAGER -> all users
// OFFICER -> all users
// MEMBER  -> own user only
//
// =============================================================

export async function GET() {
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
        "users.view"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view users.",
        },
        {
          status: 403,
        }
      );
    }

    const isMember =
      auth.role ===
      "MEMBER";

    const memberships =
      await prisma.guildMembership.findMany(
        {
          where: {
            guildId:
              auth.guild.id,

            ...(isMember
              ? {
                  userId:
                    auth.user.id,
                }
              : {}),
          },

          orderBy: [
            {
              role: "asc",
            },

            {
              user: {
                username: "asc",
              },
            },
          ],

          include: {
            user: true,
          },
        }
      );

    const userIds =
      memberships.map(
        (membership) =>
          membership.userId
      );

    const guildMembers =
      userIds.length > 0
        ? await prisma.guildMember.findMany(
            {
              where: {
                guildId:
                  auth.guild.id,

                userId: {
                  in: userIds,
                },
              },

              select: {
                id: true,
                userId: true,
                displayName: true,
                characterName: true,
                job: true,
                active: true,
              },
            }
          )
        : [];

    const guildMemberByUserId =
      new Map(
        guildMembers.map(
          (member) => [
            member.userId,
            member,
          ]
        )
      );

    return NextResponse.json({
      currentUser: {
        id:
          auth.user.id,

        role:
          auth.role,
      },

      users:
        memberships.map(
          (membership) => {
            const member =
              guildMemberByUserId.get(
                membership.userId
              );

            return {
              id:
                membership.user.id,

              membershipId:
                membership.id,

              discordId:
                membership.user
                  .discordId,

              username:
                membership.user
                  .username,

              avatarUrl:
                membership.user
                  .avatarUrl,

              role:
                membership.role,

              createdAt:
                membership.createdAt,

              updatedAt:
                membership.updatedAt,

              guildMember:
                member
                  ? {
                      id:
                        member.id,

                      displayName:
                        member.displayName,

                      characterName:
                        member.characterName,

                      job:
                        member.job,

                      active:
                        member.active,
                    }
                  : null,
            };
          }
        ),
    });
  } catch (error) {
    console.error(
      "[GUILD USERS GET]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load users.",
      },
      {
        status: 500,
      }
    );
  }
}

// =============================================================
// POST
// Add a user to the current guild
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

    const body =
      await request.json();

    const discordId =
      typeof body.discordId ===
      "string"
        ? body.discordId.trim()
        : "";

    const role =
      body.role;

    if (!discordId) {
      return NextResponse.json(
        {
          error:
            "Discord ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isUserRole(role)
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

    // ADMIN cannot be granted through the
    // normal Add User endpoint.

    if (
      role === "ADMIN"
    ) {
      return NextResponse.json(
        {
          error:
            "ADMIN access can only be assigned through the protected administration flow.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      !canManageRole(
        auth.role,
        "MEMBER",
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

    const user =
      await prisma.user.findUnique(
        {
          where: {
            discordId,
          },
        }
      );

    if (!user) {
      return NextResponse.json(
        {
          error:
            "No user with that Discord ID has logged into ROO Guild Suite yet.",
        },
        {
          status: 404,
        }
      );
    }

    const existing =
      await prisma.guildMembership.findUnique(
        {
          where: {
            userId_guildId: {
              userId:
                user.id,

              guildId:
                auth.guild.id,
            },
          },
        }
      );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "This user already has access to the guild.",
        },
        {
          status: 409,
        }
      );
    }

    const membership =
      await prisma.guildMembership.create(
        {
          data: {
            userId:
              user.id,

            guildId:
              auth.guild.id,

            role,
          },

          include: {
            user: true,
          },
        }
      );

    return NextResponse.json(
      {
        user: {
          id:
            membership.user.id,

          membershipId:
            membership.id,

          discordId:
            membership.user
              .discordId,

          username:
            membership.user
              .username,

          avatarUrl:
            membership.user
              .avatarUrl,

          role:
            membership.role,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "[GUILD USERS POST]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to add user.",
      },
      {
        status: 500,
      }
    );
  }
}