import { NextResponse } from "next/server";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import { JOBS } from "@/lib/constants/jobs";

type MemberRequest = {
  id?: string;

  displayName?: string;
  characterName?: string;
  job?: string;

  pdef?: number | null;
  mdef?: number | null;

  pvpDamageBonus?: number | null;
  pvpDamageReduction?: number | null;

  pdmgPercent?: number | null;
  mdmgPercent?: number | null;
  pdmgReductionPercent?: number | null;
  mdmgReductionPercent?: number | null;

  critRes?: number | null;
  ignorePdef?: number | null;
  ignoreMdef?: number | null;

  damageVsMedium?: number | null;
  damageReductionVsMedium?: number | null;

  damageVsSmall?: number | null;
  damageReductionVsSmall?: number | null;

  damageVsDemiHuman?: number | null;
  damageReductionVsDemiHuman?: number | null;

  damageVsBrute?: number | null;
  damageReductionVsBrute?: number | null;

  equipmentPdefPercent?: number | null;
  equipmentMdefPercent?: number | null;

  patk?: number | null;
  matk?: number | null;
  hp?: number | null;

  active?: boolean;
  eligible?: boolean;

  /*
   * This is the MEMBER priority field used
   * by allocation. It is NOT the SaaS user role.
   */
  priority?:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";

  remarks?: string | null;
};

async function getAuth() {
  return getCurrentAuth();
}

function numberOrNull(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function validateMember(
  body: MemberRequest
) {
  const displayName =
    body.displayName?.trim();

  const characterName =
    body.characterName?.trim();

  if (!displayName) {
    return {
      error:
        "Display name is required.",
    };
  }

  if (!characterName) {
    return {
      error:
        "Character name is required.",
    };
  }

  if (
    !body.job ||
    !JOBS.includes(
      body.job as (typeof JOBS)[number]
    )
  ) {
    return {
      error:
        "A valid job is required.",
    };
  }

  const priority =
    body.priority ?? "MEMBER";

  if (
    ![
      "LEADER",
      "OFFICER",
      "COUNCIL",
      "MEMBER",
    ].includes(priority)
  ) {
    return {
      error:
        "Invalid member priority.",
    };
  }

  return {
    displayName,
    characterName,
    job: body.job,

    pdef: numberOrNull(
      body.pdef
    ),

    mdef: numberOrNull(
      body.mdef
    ),

    pvpDamageBonus:
      numberOrNull(
        body.pvpDamageBonus
      ),

    pvpDamageReduction:
      numberOrNull(
        body.pvpDamageReduction
      ),

    pdmgPercent:
      numberOrNull(
        body.pdmgPercent
      ),

    mdmgPercent:
      numberOrNull(
        body.mdmgPercent
      ),

    pdmgReductionPercent:
      numberOrNull(
        body.pdmgReductionPercent
      ),

    mdmgReductionPercent:
      numberOrNull(
        body.mdmgReductionPercent
      ),

    critRes:
      numberOrNull(
        body.critRes
      ),

    ignorePdef:
      numberOrNull(
        body.ignorePdef
      ),

    ignoreMdef:
      numberOrNull(
        body.ignoreMdef
      ),

    damageVsMedium:
      numberOrNull(
        body.damageVsMedium
      ),

    damageReductionVsMedium:
      numberOrNull(
        body.damageReductionVsMedium
      ),

    damageVsSmall:
      numberOrNull(
        body.damageVsSmall
      ),

    damageReductionVsSmall:
      numberOrNull(
        body.damageReductionVsSmall
      ),

    damageVsDemiHuman:
      numberOrNull(
        body.damageVsDemiHuman
      ),

    damageReductionVsDemiHuman:
      numberOrNull(
        body.damageReductionVsDemiHuman
      ),

    damageVsBrute:
      numberOrNull(
        body.damageVsBrute
      ),

    damageReductionVsBrute:
      numberOrNull(
        body.damageReductionVsBrute
      ),

    equipmentPdefPercent:
      numberOrNull(
        body.equipmentPdefPercent
      ),

    equipmentMdefPercent:
      numberOrNull(
        body.equipmentMdefPercent
      ),

    patk: numberOrNull(
      body.patk
    ),

    matk: numberOrNull(
      body.matk
    ),

    hp: numberOrNull(
      body.hp
    ),

    active:
      body.active ?? true,

    eligible:
      body.eligible ?? true,

    priority,

    remarks:
      body.remarks?.trim() ||
      null,
  };
}

// =============================================================
// GET
// =============================================================

export async function GET() {
  try {
    const auth =
      await getAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "members.view"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view members.",
        },
        { status: 403 }
      );
    }

    const members =
      await prisma.guildMember.findMany(
        {
          where: {
            guildId:
              auth.guild.id,
          },

          include: {
            leaveDates: {
              orderBy: {
                date: "asc",
              },
            },
          },

          orderBy: {
            displayName: "asc",
          },
        }
      );

    return NextResponse.json({
      members,
    });
  } catch (error) {
    console.error(
      "[MEMBERS] Failed to fetch members:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch members.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// CREATE
// =============================================================

export async function POST(
  request: Request
) {
  try {
    const auth =
      await getAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "members.edit"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to add members.",
        },
        { status: 403 }
      );
    }

    const body =
      (await request.json()) as MemberRequest;

    const data =
      validateMember(body);

    if ("error" in data) {
      return NextResponse.json(
        data,
        { status: 400 }
      );
    }

    const existing =
      await prisma.guildMember.findFirst(
        {
          where: {
            guildId:
              auth.guild.id,

            displayName:
              data.displayName,
          },
        }
      );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "A member with this display name already exists.",
        },
        { status: 409 }
      );
    }

    const member =
      await prisma.guildMember.create(
        {
          data: {
            guildId:
              auth.guild.id,

            displayName:
              data.displayName,

            characterName:
              data.characterName,

            job:
              data.job,

            pdef:
              data.pdef,

            mdef:
              data.mdef,

            pvpDamageBonus:
              data.pvpDamageBonus,

            pvpDamageReduction:
              data.pvpDamageReduction,

            pdmgPercent:
              data.pdmgPercent,

            mdmgPercent:
              data.mdmgPercent,

            pdmgReductionPercent:
              data.pdmgReductionPercent,

            mdmgReductionPercent:
              data.mdmgReductionPercent,

            critRes:
              data.critRes,

            ignorePdef:
              data.ignorePdef,

            ignoreMdef:
              data.ignoreMdef,

            damageVsMedium:
              data.damageVsMedium,

            damageReductionVsMedium:
              data.damageReductionVsMedium,

            damageVsSmall:
              data.damageVsSmall,

            damageReductionVsSmall:
              data.damageReductionVsSmall,

            damageVsDemiHuman:
              data.damageVsDemiHuman,

            damageReductionVsDemiHuman:
              data.damageReductionVsDemiHuman,

            damageVsBrute:
              data.damageVsBrute,

            damageReductionVsBrute:
              data.damageReductionVsBrute,

            equipmentPdefPercent:
              data.equipmentPdefPercent,

            equipmentMdefPercent:
              data.equipmentMdefPercent,

            patk:
              data.patk,

            matk:
              data.matk,

            hp:
              data.hp,

            active:
              data.active,

            eligible:
              data.eligible,

            priority:
              data.priority,

            remarks:
              data.remarks,
          },

          include: {
            leaveDates: true,
          },
        }
      );

    return NextResponse.json({
      member,
    });
  } catch (error) {
    console.error(
      "[MEMBERS] Failed to create member:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create member.",
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
      await getAuth();

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
      (await request.json()) as MemberRequest;

    if (!body.id) {
      return NextResponse.json(
        {
          error:
            "Member ID is required.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.guildMember.findFirst(
        {
          where: {
            id: body.id,

            guildId:
              auth.guild.id,
          },
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Member not found.",
        },
        { status: 404 }
      );
    }

    const canEditAny =
      hasPermission(
        auth.role,
        "members.edit"
      );

    const isOwnMember =
      existing.userId !== null &&
      existing.userId ===
        auth.user.id;

    const canEditOwn =
      hasPermission(
        auth.role,
        "profile.editOwn"
      ) && isOwnMember;

    if (
      !canEditAny &&
      !canEditOwn
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to edit this member.",
        },
        { status: 403 }
      );
    }

    const data =
      validateMember(body);

    if ("error" in data) {
      return NextResponse.json(
        data,
        { status: 400 }
      );
    }

    const duplicate =
      await prisma.guildMember.findFirst(
        {
          where: {
            guildId:
              auth.guild.id,

            displayName:
              data.displayName,

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
            "A member with this display name already exists.",
        },
        { status: 409 }
      );
    }

    /*
     * MEMBER self-edit:
     *
     * They may change their player/profile
     * information, but not guild-managed
     * allocation/access fields.
     */
    const updateData: Record<
      string,
      unknown
    > = {
      displayName:
        data.displayName,

      characterName:
        data.characterName,

      job:
        data.job,

      pdef:
        data.pdef,

      mdef:
        data.mdef,

      pvpDamageBonus:
        data.pvpDamageBonus,

      pvpDamageReduction:
        data.pvpDamageReduction,

      pdmgPercent:
        data.pdmgPercent,

      mdmgPercent:
        data.mdmgPercent,

      pdmgReductionPercent:
        data.pdmgReductionPercent,

      mdmgReductionPercent:
        data.mdmgReductionPercent,

      critRes:
        data.critRes,

      ignorePdef:
        data.ignorePdef,

      ignoreMdef:
        data.ignoreMdef,

      damageVsMedium:
        data.damageVsMedium,

      damageReductionVsMedium:
        data.damageReductionVsMedium,

      damageVsSmall:
        data.damageVsSmall,

      damageReductionVsSmall:
        data.damageReductionVsSmall,

      damageVsDemiHuman:
        data.damageVsDemiHuman,

      damageReductionVsDemiHuman:
        data.damageReductionVsDemiHuman,

      damageVsBrute:
        data.damageVsBrute,

      damageReductionVsBrute:
        data.damageReductionVsBrute,

      equipmentPdefPercent:
        data.equipmentPdefPercent,

      equipmentMdefPercent:
        data.equipmentMdefPercent,

      patk:
        data.patk,

      matk:
        data.matk,

      hp:
        data.hp,
    };

    if (canEditAny) {
      updateData.active =
        data.active;

      updateData.eligible =
        data.eligible;

      updateData.priority =
        data.priority;

      updateData.remarks =
        data.remarks;
    }

    const member =
      await prisma.guildMember.update(
        {
          where: {
            id: body.id,
          },

          data: updateData,

          include: {
            leaveDates: true,
          },
        }
      );

    return NextResponse.json({
      member,
    });
  } catch (error) {
    console.error(
      "[MEMBERS] Failed to update member:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update member.",
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
      await getAuth();

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        auth.role,
        "members.delete"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete members.",
        },
        { status: 403 }
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
            "Member ID is required.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.guildMember.findFirst(
        {
          where: {
            id,

            guildId:
              auth.guild.id,
          },
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Member not found.",
        },
        { status: 404 }
      );
    }

    await prisma.guildMember.delete(
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
      "[MEMBERS] Failed to delete member:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete member.",
      },
      { status: 500 }
    );
  }
}