import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JOBS } from "@/lib/constants/jobs";

import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth";

type ImportRow = Record<string, unknown>;

const MEMBER_FIELDS = [
  "displayName",
  "characterName",
  "job",
  "active",
  "eligible",
  "priority",
  "remarks",

  "pdef",
  "mdef",

  "pvpDamageBonus",
  "pvpDamageReduction",

  "pdmgPercent",
  "mdmgPercent",
  "pdmgReductionPercent",
  "mdmgReductionPercent",

  "critRes",
  "ignorePdef",
  "ignoreMdef",

  "damageVsMedium",
  "damageReductionVsMedium",

  "damageVsSmall",
  "damageReductionVsSmall",

  "damageVsDemiHuman",
  "damageReductionVsDemiHuman",

  "damageVsBrute",
  "damageReductionVsBrute",

  "equipmentPdefPercent",
  "equipmentMdefPercent",

  "patk",
  "matk",
  "hp",
] as const;

type MemberField =
  (typeof MEMBER_FIELDS)[number];

const NUMBER_FIELDS = new Set<string>([
  "pdef",
  "mdef",

  "pvpDamageBonus",
  "pvpDamageReduction",

  "pdmgPercent",
  "mdmgPercent",
  "pdmgReductionPercent",
  "mdmgReductionPercent",

  "critRes",
  "ignorePdef",
  "ignoreMdef",

  "damageVsMedium",
  "damageReductionVsMedium",

  "damageVsSmall",
  "damageReductionVsSmall",

  "damageVsDemiHuman",
  "damageReductionVsDemiHuman",

  "damageVsBrute",
  "damageReductionVsBrute",

  "equipmentPdefPercent",
  "equipmentMdefPercent",

  "patk",
  "matk",
  "hp",
]);

const BOOLEAN_FIELDS = new Set<string>([
  "active",
  "eligible",
]);

const PRIORITIES = [
  "LEADER",
  "OFFICER",
  "COUNCIL",
  "MEMBER",
] as const;

async function getGuild() {
  return prisma.guild.findFirst({
    select: {
      id: true,
    },
  });
}

function normaliseHeader(
  header: string
): string {
  return header
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "");
}

const HEADER_ALIASES: Record<
  string,
  MemberField
> = {
  displayname: "displayName",
  discord: "displayName",
  discordname: "displayName",
  discordusername: "displayName",
  username: "displayName",

  character: "characterName",
  charactername: "characterName",
  charname: "characterName",

  job: "job",
  class: "job",

  active: "active",
  status: "active",

  eligible: "eligible",
  allocationeligible: "eligible",

  priority: "priority",
  rank: "priority",

  remarks: "remarks",
  remark: "remarks",
  notes: "remarks",
  note: "remarks",

  pdef: "pdef",
  pdefense: "pdef",
  physicaldefense: "pdef",

  mdef: "mdef",
  mdefense: "mdef",
  magicdefense: "mdef",

  pvpdamagebonus: "pvpDamageBonus",
  pvpdmgbonus: "pvpDamageBonus",

  pvpdamagereduction:
    "pvpDamageReduction",
  pvpdmgreduction:
    "pvpDamageReduction",

  pdmgpercent: "pdmgPercent",
  pdmg: "pdmgPercent",

  mdmgpercent: "mdmgPercent",
  mdmg: "mdmgPercent",

  pdmgreductionpercent:
    "pdmgReductionPercent",

  mdmgreductionpercent:
    "mdmgReductionPercent",

  critres: "critRes",
  critresistance: "critRes",

  ignorepdef: "ignorePdef",
  ignorepdefpercent: "ignorePdef",

  ignoremdef: "ignoreMdef",
  ignoremdefpercent: "ignoreMdef",

  damagevssmall: "damageVsSmall",
  dmgvssmall: "damageVsSmall",

  damagereductionvssmall:
    "damageReductionVsSmall",

  reductionvssmall:
    "damageReductionVsSmall",

  damagevsmedium: "damageVsMedium",
  dmgvsmedium: "damageVsMedium",

  damagereductionvsmedium:
    "damageReductionVsMedium",

  reductionvsmedium:
    "damageReductionVsMedium",

  damagevsdemihuman:
    "damageVsDemiHuman",

  dmgvsdemihuman:
    "damageVsDemiHuman",

  damagereductionvsdemihuman:
    "damageReductionVsDemiHuman",

  reductionvsdemihuman:
    "damageReductionVsDemiHuman",

  damagevsbrute: "damageVsBrute",
  dmgvsbrute: "damageVsBrute",

  damagereductionvsbrute:
    "damageReductionVsBrute",

  reductionvsbrute:
    "damageReductionVsBrute",

  equipmentpdefpercent:
    "equipmentPdefPercent",

  equipmentmdefpercent:
    "equipmentMdefPercent",

  patk: "patk",
  matk: "matk",
  hp: "hp",
};

function getValue(
  row: ImportRow,
  field: MemberField
) {
  return row[field];
}

function parseNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const cleaned = String(value)
    .trim()
    .replace(/,/g, "")
    .replace(/%$/, "");

  const number = Number(cleaned);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function parseBoolean(
  value: unknown
): boolean | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "y",
      "active",
      "eligible",
    ].includes(normalized)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "n",
      "inactive",
      "ineligible",
    ].includes(normalized)
  ) {
    return false;
  }

  return null;
}

function parsePriority(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toUpperCase();

  const aliases: Record<
    string,
    (typeof PRIORITIES)[number]
  > = {
    LEADER: "LEADER",
    LEAD: "LEADER",

    OFFICER: "OFFICER",

    COUNCIL: "COUNCIL",

    MEMBER: "MEMBER",
  };

  return (
    aliases[normalized] ??
    null
  );
}

function validateRow(
  row: ImportRow,
  rowNumber: number
) {
  const errors: string[] = [];

  const rawDisplayName =
    getValue(
      row,
      "displayName"
    );

  const displayName =
    rawDisplayName ===
    undefined
      ? ""
      : String(
          rawDisplayName
        ).trim();

  if (!displayName) {
    errors.push(
      "Display name is required."
    );
  }

  const characterNameRaw =
    getValue(
      row,
      "characterName"
    );

  const characterName =
    characterNameRaw ===
      undefined ||
    characterNameRaw === null
      ? ""
      : String(
          characterNameRaw
        ).trim();

  if (!characterName) {
    errors.push(
      "Character name is required."
    );
  }

  const jobRaw =
    getValue(row, "job");

  const job =
    jobRaw === undefined ||
    jobRaw === null
      ? ""
      : String(jobRaw).trim();

  if (!job) {
    errors.push(
      "Job is required."
    );
  } else if (
    !JOBS.includes(
      job as (typeof JOBS)[number]
    )
  ) {
    errors.push(
      `Invalid job "${job}".`
    );
  }

  const priorityValue =
    getValue(row, "priority");

  if (
    priorityValue !==
      undefined &&
    String(priorityValue).trim()
  ) {
    if (
      !parsePriority(
        priorityValue
      )
    ) {
      errors.push(
        `Invalid priority "${priorityValue}".`
      );
    }
  }

  for (const field of NUMBER_FIELDS) {
    const value =
      getValue(
        row,
        field as MemberField
      );

    if (
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      if (
        parseNumber(value) ===
        null
      ) {
        errors.push(
          `${field} must be a number.`
        );
      }
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    const value =
      getValue(
        row,
        field as MemberField
      );

    if (
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      if (
        parseBoolean(value) ===
        null
      ) {
        errors.push(
          `${field} must be true/false, yes/no, or 1/0.`
        );
      }
    }
  }

  return {
    rowNumber,
    displayName,
    characterName,
    job,
    errors,
  };
}

function buildCreateData(
  row: ImportRow,
  guildId: string
) {
  const displayName =
    String(
      getValue(
        row,
        "displayName"
      ) ?? ""
    ).trim();

  const characterName =
    String(
      getValue(
        row,
        "characterName"
      ) ?? ""
    ).trim();

  const job =
    String(
      getValue(
        row,
        "job"
      ) ?? ""
    ).trim();

  const priority =
    parsePriority(
      getValue(
        row,
        "priority"
      )
    ) ?? "MEMBER";

  const activeValue =
    parseBoolean(
      getValue(
        row,
        "active"
      )
    );

  const eligibleValue =
    parseBoolean(
      getValue(
        row,
        "eligible"
      )
    );

  return {
    guildId,

    displayName,

    characterName:
      characterName || null,

    job:
      job || null,

    active:
      activeValue ?? true,

    eligible:
      eligibleValue ?? true,

    priority,

    remarks:
      String(
        getValue(
          row,
          "remarks"
        ) ?? ""
      ).trim() || null,

    pdef: parseNumber(
      getValue(row, "pdef")
    ),

    mdef: parseNumber(
      getValue(row, "mdef")
    ),

    pvpDamageBonus:
      parseNumber(
        getValue(
          row,
          "pvpDamageBonus"
        )
      ),

    pvpDamageReduction:
      parseNumber(
        getValue(
          row,
          "pvpDamageReduction"
        )
      ),

    pdmgPercent:
      parseNumber(
        getValue(
          row,
          "pdmgPercent"
        )
      ),

    mdmgPercent:
      parseNumber(
        getValue(
          row,
          "mdmgPercent"
        )
      ),

    pdmgReductionPercent:
      parseNumber(
        getValue(
          row,
          "pdmgReductionPercent"
        )
      ),

    mdmgReductionPercent:
      parseNumber(
        getValue(
          row,
          "mdmgReductionPercent"
        )
      ),

    critRes: parseNumber(
      getValue(
        row,
        "critRes"
      )
    ),

    ignorePdef:
      parseNumber(
        getValue(
          row,
          "ignorePdef"
        )
      ),

    ignoreMdef:
      parseNumber(
        getValue(
          row,
          "ignoreMdef"
        )
      ),

    damageVsMedium:
      parseNumber(
        getValue(
          row,
          "damageVsMedium"
        )
      ),

    damageReductionVsMedium:
      parseNumber(
        getValue(
          row,
          "damageReductionVsMedium"
        )
      ),

    damageVsSmall:
      parseNumber(
        getValue(
          row,
          "damageVsSmall"
        )
      ),

    damageReductionVsSmall:
      parseNumber(
        getValue(
          row,
          "damageReductionVsSmall"
        )
      ),

    damageVsDemiHuman:
      parseNumber(
        getValue(
          row,
          "damageVsDemiHuman"
        )
      ),

    damageReductionVsDemiHuman:
      parseNumber(
        getValue(
          row,
          "damageReductionVsDemiHuman"
        )
      ),

    damageVsBrute:
      parseNumber(
        getValue(
          row,
          "damageVsBrute"
        )
      ),

    damageReductionVsBrute:
      parseNumber(
        getValue(
          row,
          "damageReductionVsBrute"
        )
      ),

    equipmentPdefPercent:
      parseNumber(
        getValue(
          row,
          "equipmentPdefPercent"
        )
      ),

    equipmentMdefPercent:
      parseNumber(
        getValue(
          row,
          "equipmentMdefPercent"
        )
      ),

    patk: parseNumber(
      getValue(row, "patk")
    ),

    matk: parseNumber(
      getValue(row, "matk")
    ),

    hp: parseNumber(
      getValue(row, "hp")
    ),
  };
}

function buildUpdateData(
  row: ImportRow
) {
  const data: Record<
    string,
    unknown
  > = {};

  for (const field of MEMBER_FIELDS) {
    if (
      field ===
      "displayName"
    ) {
      continue;
    }

    const value =
      getValue(
        row,
        field
      );

    // Important:
    // Undefined means the CSV did not
    // contain this field. Do NOT touch
    // the existing database value.
    if (value === undefined) {
      continue;
    }

    if (
      NUMBER_FIELDS.has(field)
    ) {
      data[field] =
        parseNumber(value);
      continue;
    }

    if (
      BOOLEAN_FIELDS.has(field)
    ) {
      const parsed =
        parseBoolean(value);

      if (parsed !== null) {
        data[field] =
          parsed;
      }

      continue;
    }

    if (
      field === "priority"
    ) {
      const parsed =
        parsePriority(value);

      if (parsed !== null) {
        data[field] =
          parsed;
      }

      continue;
    }

    if (
      field ===
        "characterName" ||
      field === "job" ||
      field === "remarks"
    ) {
      const text =
        String(
          value ?? ""
        ).trim();

      data[field] =
        text || null;

      continue;
    }
  }

  return data;
}

// =============================================================
// POST
// =============================================================

export async function POST(
  request: Request
) {

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

  if (
    !hasPermission(
      auth.role,
      "members.import"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to import members.",
      },
      { status: 403 }
    );
  }
  try {
    const body =
      await request.json();

    const rows =
      body.rows;

    if (
      !Array.isArray(rows)
    ) {
      return NextResponse.json(
        {
          error:
            "Import rows are required.",
        },
        { status: 400 }
      );
    }

    if (
      rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "The import contains no rows.",
        },
        { status: 400 }
      );
    }

    if (
      rows.length > 1000
    ) {
      return NextResponse.json(
        {
          error:
            "A maximum of 1,000 members can be imported at once.",
        },
        { status: 400 }
      );
    }

    const guild = {
      id: auth.guild.id,
    };

    if (!guild) {
      return NextResponse.json(
        {
          error:
            "No guild has been configured.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // Validate rows
    // ---------------------------------------------------------

    const validatedRows =
      rows.map(
        (
          row: ImportRow,
          index: number
        ) =>
          validateRow(
            row,
            index + 2
          )
      );

    const seen =
      new Map<
        string,
        number
      >();

    for (const row of validatedRows) {
      if (!row.displayName) {
        continue;
      }

      const key =
        row.displayName
          .toLowerCase();

      const previous =
        seen.get(key);

      if (
        previous !==
        undefined
      ) {
        row.errors.push(
          `Duplicate display name in CSV; first appears on row ${previous}.`
        );
      } else {
        seen.set(
          key,
          row.rowNumber
        );
      }
    }

    const validationErrors =
      validatedRows.filter(
        (row) =>
          row.errors.length >
          0
      );

    if (
      validationErrors.length >
      0
    ) {
      return NextResponse.json({
        success: false,

        created: 0,
        updated: 0,

        errors:
          validationErrors.map(
            (row) => ({
              row:
                row.rowNumber,

              displayName:
                row.displayName,

              errors:
                row.errors,
            })
          ),

        message:
          "Import validation failed. No changes were made.",
      });
    }

    // ---------------------------------------------------------
    // Import
    // ---------------------------------------------------------

    let created = 0;
    let updated = 0;

    const results: {
      row: number;
      displayName: string;
      action:
        | "created"
        | "updated";
    }[] = [];

    await prisma.$transaction(
      async (tx) => {
        for (
          let index = 0;
          index < rows.length;
          index++
        ) {
          const row =
            rows[index] as ImportRow;

          const displayName =
            String(
              getValue(
                row,
                "displayName"
              )
            ).trim();

          const existing =
            await tx.guildMember.findFirst(
              {
                where: {
                  guildId:
                    guild.id,

                  displayName,
                },
              }
            );

          if (existing) {
            const data =
              buildUpdateData(
                row
              );

            await tx.guildMember.update(
              {
                where: {
                  id: existing.id,
                },

                data,
              }
            );

            updated++;

            results.push({
              row: index + 2,
              displayName,
              action: "updated",
            });
          } else {
            const data =
              buildCreateData(
                row,
                guild.id
              );

            await tx.guildMember.create(
              {
                data,
              }
            );

            created++;

            results.push({
              row: index + 2,
              displayName,
              action: "created",
            });
          }
        }
      }
    );

    return NextResponse.json({
      success: true,

      created,
      updated,

      total:
        created + updated,

      errors: [],

      results,
    });
  } catch (error) {
    console.error(
      "[MEMBERS IMPORT]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import members.",
      },
      { status: 500 }
    );
  }
}