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
// GET
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

    /*
     * User management is available to
     * LEADER and OFFICER only.
     *
     * The API is the authoritative
     * permission boundary.
     */
    if (
      auth.role !== "LEADER" &&
      auth.role !== "OFFICER"
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

    const memberships =
      await prisma.guildMembership.findMany(
        {
          where: {
            guildId:
              auth.guild.id,
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

      users: memberships.map(
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

    const body =
      await request.json();

    const discordId =
      typeof body.discordId ===
      "string"
        ? body.discordId.trim()
        : "";

    const role =
      body.role as UserRole;

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

    /*
     * OFFICER can only create MEMBER
     * or OFFICER accounts.
     */
    if (
      auth.role === "OFFICER" &&
      role !== "MEMBER" &&
      role !== "OFFICER"
    ) {
      return NextResponse.json(
        {
          error:
            "OFFICER can only assign MEMBER or OFFICER roles.",
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

    /*
     * Prevent duplicate guild access.
     */
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