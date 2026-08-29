import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JOBS } from "@/lib/constants/jobs";
import { getCurrentAuth, hasPermission } from "@/lib/auth";

type ImportRow = Record<string, unknown>;

const MEMBER_FIELDS = [
  "characterName", "job", "active", "eligible", "priority", "remarks",
  "discordUserId", "discordUsername",
  "pdef", "mdef", "pvpDamageBonus", "pvpDamageReduction",
  "pdmgPercent", "mdmgPercent", "pdmgReductionPercent", "mdmgReductionPercent",
  "critRes", "ignorePdef", "ignoreMdef", "damageVsMedium", "damageReductionVsMedium",
  "damageVsSmall", "damageReductionVsSmall", "damageVsDemiHuman", "damageReductionVsDemiHuman",
  "damageVsBrute", "damageReductionVsBrute", "equipmentPdefPercent", "equipmentMdefPercent",
  "patk", "matk", "hp",
] as const;

type MemberField = (typeof MEMBER_FIELDS)[number];

const NUMBER_FIELDS = new Set<string>([
  "pdef", "mdef", "pvpDamageBonus", "pvpDamageReduction", "pdmgPercent", "mdmgPercent",
  "pdmgReductionPercent", "mdmgReductionPercent", "critRes", "ignorePdef", "ignoreMdef",
  "damageVsMedium", "damageReductionVsMedium", "damageVsSmall", "damageReductionVsSmall",
  "damageVsDemiHuman", "damageReductionVsDemiHuman", "damageVsBrute", "damageReductionVsBrute",
  "equipmentPdefPercent", "equipmentMdefPercent", "patk", "matk", "hp",
]);

const BOOLEAN_FIELDS = new Set<string>(["active", "eligible"]);
const PRIORITIES = ["LEADER", "OFFICER", "COUNCIL", "MEMBER"] as const;

function normaliseHeader(header: string) {
  return header.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s_\-./]+/g, "");
}

const HEADER_ALIASES: Record<string, MemberField> = {
  displayname: "discordUsername", discord: "discordUsername", discordname: "discordUsername",
  discordusername: "discordUsername", username: "discordUsername", discordid: "discordUserId",
  discorduserid: "discordUserId", discorduser: "discordUserId", character: "characterName",
  charactername: "characterName", charname: "characterName", job: "job", class: "job",
  active: "active", status: "active", eligible: "eligible", allocationeligible: "eligible",
  priority: "priority", rank: "priority", remarks: "remarks", remark: "remarks", notes: "remarks", note: "remarks",
  pdef: "pdef", pdefense: "pdef", physicaldefense: "pdef", mdef: "mdef", mdefense: "mdef", magicdefense: "mdef",
  pvpdamagebonus: "pvpDamageBonus", pvpdmgbonus: "pvpDamageBonus", pvpdamagereduction: "pvpDamageReduction", pvpdmgreduction: "pvpDamageReduction",
  pdmgpercent: "pdmgPercent", pdmg: "pdmgPercent", mdmgpercent: "mdmgPercent", mdmg: "mdmgPercent",
  pdmgreductionpercent: "pdmgReductionPercent", mdmgreductionpercent: "mdmgReductionPercent", critres: "critRes", critresistance: "critRes",
  ignorepdef: "ignorePdef", ignorepdefpercent: "ignorePdef", ignoremdef: "ignoreMdef", ignoremdefpercent: "ignoreMdef",
  damagevssmall: "damageVsSmall", dmgvssmall: "damageVsSmall", damagereductionvssmall: "damageReductionVsSmall", reductionvssmall: "damageReductionVsSmall",
  damagevsmedium: "damageVsMedium", dmgvsmedium: "damageVsMedium", damagereductionvsmedium: "damageReductionVsMedium", reductionvsmedium: "damageReductionVsMedium",
  damagevsdemihuman: "damageVsDemiHuman", dmgvsdemihuman: "damageVsDemiHuman", damagereductionvsdemihuman: "damageReductionVsDemiHuman", reductionvsdemihuman: "damageReductionVsDemiHuman",
  damagevsbrute: "damageVsBrute", dmgvsbrute: "damageVsBrute", damagereductionvsbrute: "damageReductionVsBrute", reductionvsbrute: "damageReductionVsBrute",
  equipmentpdefpercent: "equipmentPdefPercent", equipmentmdefpercent: "equipmentMdefPercent", patk: "patk", matk: "matk", hp: "hp",
};

function getValue(row: ImportRow, field: MemberField) { return row[field]; }

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).trim().replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(number) ? number : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "active", "eligible"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "inactive", "ineligible"].includes(normalized)) return false;
  return null;
}

function parsePriority(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim().toUpperCase();
  const aliases: Record<string, (typeof PRIORITIES)[number]> = {
    LEADER: "LEADER", LEAD: "LEADER", OFFICER: "OFFICER", COUNCIL: "COUNCIL", MEMBER: "MEMBER",
  };
  return aliases[normalized] ?? null;
}

function parseDiscordUserId(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim();
  return /^\d{17,20}$/.test(normalized) ? normalized : null;
}

function parseDiscordUsername(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value).trim();
}

function validateRow(row: ImportRow, rowNumber: number) {
  const errors: string[] = [];
  const discordUsername = String(getValue(row, "discordUsername") ?? "").trim();
  const characterName = String(getValue(row, "characterName") ?? "").trim();
  const job = String(getValue(row, "job") ?? "").trim();

  if (!discordUsername) errors.push("Discord Username is required.");
  if (!characterName) errors.push("Character name is required.");
  if (!job) errors.push("Job is required.");
  else if (!JOBS.includes(job as (typeof JOBS)[number])) errors.push(`Invalid job \"${job}\".`);

  const priorityValue = getValue(row, "priority");
  if (priorityValue !== undefined && String(priorityValue).trim() && !parsePriority(priorityValue)) {
    errors.push(`Invalid priority \"${priorityValue}\".`);
  }

  const discordIdRaw = getValue(row, "discordUserId");
  if (discordIdRaw !== undefined && String(discordIdRaw).trim() && !parseDiscordUserId(discordIdRaw)) {
    errors.push("Discord User ID must be a 17-20 digit Discord ID.");
  }

  for (const field of NUMBER_FIELDS) {
    const value = getValue(row, field as MemberField);
    if (value !== undefined && String(value).trim() !== "" && parseNumber(value) === null) {
      errors.push(`${field} must be a number.`);
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    const value = getValue(row, field as MemberField);
    if (value !== undefined && String(value).trim() !== "" && parseBoolean(value) === null) {
      errors.push(`${field} must be true/false, yes/no, or 1/0.`);
    }
  }

  return { rowNumber, discordUsername, characterName, job, errors };
}

function buildCreateData(row: ImportRow, guildId: string, userId: string | null) {
  const characterName = String(getValue(row, "characterName") ?? "").trim();
  const job = String(getValue(row, "job") ?? "").trim();
  return {
    guildId,
    userId,
    discordUserId: parseDiscordUserId(getValue(row, "discordUserId")),
    discordUsername: parseDiscordUsername(getValue(row, "discordUsername")),
    characterName: characterName || null,
    job: job || null,
    active: parseBoolean(getValue(row, "active")) ?? true,
    eligible: parseBoolean(getValue(row, "eligible")) ?? true,
    priority: parsePriority(getValue(row, "priority")) ?? "MEMBER",
    remarks: String(getValue(row, "remarks") ?? "").trim() || null,
    pdef: parseNumber(getValue(row, "pdef")), mdef: parseNumber(getValue(row, "mdef")),
    pvpDamageBonus: parseNumber(getValue(row, "pvpDamageBonus")), pvpDamageReduction: parseNumber(getValue(row, "pvpDamageReduction")),
    pdmgPercent: parseNumber(getValue(row, "pdmgPercent")), mdmgPercent: parseNumber(getValue(row, "mdmgPercent")),
    pdmgReductionPercent: parseNumber(getValue(row, "pdmgReductionPercent")), mdmgReductionPercent: parseNumber(getValue(row, "mdmgReductionPercent")),
    critRes: parseNumber(getValue(row, "critRes")), ignorePdef: parseNumber(getValue(row, "ignorePdef")), ignoreMdef: parseNumber(getValue(row, "ignoreMdef")),
    damageVsMedium: parseNumber(getValue(row, "damageVsMedium")), damageReductionVsMedium: parseNumber(getValue(row, "damageReductionVsMedium")),
    damageVsSmall: parseNumber(getValue(row, "damageVsSmall")), damageReductionVsSmall: parseNumber(getValue(row, "damageReductionVsSmall")),
    damageVsDemiHuman: parseNumber(getValue(row, "damageVsDemiHuman")), damageReductionVsDemiHuman: parseNumber(getValue(row, "damageReductionVsDemiHuman")),
    damageVsBrute: parseNumber(getValue(row, "damageVsBrute")), damageReductionVsBrute: parseNumber(getValue(row, "damageReductionVsBrute")),
    equipmentPdefPercent: parseNumber(getValue(row, "equipmentPdefPercent")), equipmentMdefPercent: parseNumber(getValue(row, "equipmentMdefPercent")),
    patk: parseNumber(getValue(row, "patk")), matk: parseNumber(getValue(row, "matk")), hp: parseNumber(getValue(row, "hp")),
  };
}

function buildUpdateData(row: ImportRow, userId: string | null | undefined) {
  const data: Record<string, unknown> = {};
  for (const field of MEMBER_FIELDS) {
    const value = getValue(row, field);
    if (value === undefined) continue;
    if (field === "discordUserId") { data[field] = parseDiscordUserId(value); continue; }
    if (field === "discordUsername") { data[field] = parseDiscordUsername(value); continue; }
    if (NUMBER_FIELDS.has(field)) { data[field] = parseNumber(value); continue; }
    if (BOOLEAN_FIELDS.has(field)) { const parsed = parseBoolean(value); if (parsed !== null) data[field] = parsed; continue; }
    if (field === "priority") { const parsed = parsePriority(value); if (parsed !== null) data[field] = parsed; continue; }
    if (["characterName", "job", "remarks"].includes(field)) { data[field] = String(value ?? "").trim() || null; continue; }
  }
  if (userId !== undefined) data.userId = userId;
  return data;
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "members.import")) {
    return NextResponse.json({ error: "You do not have permission to import members." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const rows = body.rows;
    if (!Array.isArray(rows)) return NextResponse.json({ error: "Import rows are required." }, { status: 400 });
    if (rows.length === 0) return NextResponse.json({ error: "The import contains no rows." }, { status: 400 });
    if (rows.length > 1000) return NextResponse.json({ error: "A maximum of 1,000 members can be imported at once." }, { status: 400 });

    const normalizedRows: ImportRow[] = rows.map((raw: ImportRow) => {
      const result: ImportRow = {};
      for (const [key, value] of Object.entries(raw)) {
        const field = HEADER_ALIASES[normaliseHeader(key)];
        if (field) result[field] = value;
        else result[key] = value;
      }
      return result;
    });

    const validatedRows = normalizedRows.map((row, index) => validateRow(row, index + 2));
    const seenUsernames = new Map<string, number>();
    const seenDiscordIds = new Map<string, number>();

    for (const row of validatedRows) {
      if (row.discordUsername) {
        const key = row.discordUsername.toLowerCase();
        const previous = seenUsernames.get(key);
        if (previous !== undefined) row.errors.push(`Duplicate Discord username in CSV; first appears on row ${previous}.`);
        else seenUsernames.set(key, row.rowNumber);
      }

      const discordId = parseDiscordUserId(getValue(normalizedRows[row.rowNumber - 2], "discordUserId"));
      if (discordId) {
        const previous = seenDiscordIds.get(discordId);
        if (previous !== undefined) row.errors.push(`Duplicate Discord User ID in CSV; first appears on row ${previous}.`);
        else seenDiscordIds.set(discordId, row.rowNumber);
      }
    }

    const discordIds = [...seenDiscordIds.keys()];
    const usernames = [...seenUsernames.keys()];
    const guildId = auth.guild.id;

    const [usersByDiscordId, usersByUsername, existingMembers] = await Promise.all([
      discordIds.length
        ? prisma.user.findMany({
            where: { discordId: { in: discordIds } },
            select: { id: true, discordId: true, username: true },
          })
        : Promise.resolve([]),
      usernames.length
        ? prisma.user.findMany({
            where: { username: { in: usernames, mode: "insensitive" } },
            select: { id: true, discordId: true, username: true },
          })
        : Promise.resolve([]),
      prisma.guildMember.findMany({
        where: {
          guildId,
          OR: [
            ...(usernames.length ? usernames.map((username) => ({ discordUsername: username })) : []),
            ...(discordIds.length ? [{ discordUserId: { in: discordIds } }] : []),
          ],
        },
        select: { id: true, discordUsername: true, discordUserId: true },
      }),
    ]);

    const userByDiscordId = new Map(usersByDiscordId.map((user) => [user.discordId, user]));
    const usersByUsernameLower = new Map<string, typeof usersByUsername>();
    for (const user of usersByUsername) {
      const key = user.username.toLowerCase();
      const matches = usersByUsernameLower.get(key) ?? [];
      matches.push(user);
      usersByUsernameLower.set(key, matches);
    }

    const memberByUsername = new Map<string, (typeof existingMembers)[number]>();
    const memberByDiscordId = new Map<string, (typeof existingMembers)[number]>();
    for (const member of existingMembers) {
      if (member.discordUsername) memberByUsername.set(member.discordUsername, member);
      if (member.discordUserId) memberByDiscordId.set(member.discordUserId, member);
    }

    const resolvedUserIds: Array<string | null> = [];

    for (let index = 0; index < normalizedRows.length; index++) {
      const row = normalizedRows[index];
      const validated = validatedRows[index];
      const discordId = parseDiscordUserId(getValue(row, "discordUserId"));
      const discordUsername = parseDiscordUsername(getValue(row, "discordUsername"));

      let userId: string | null = null;
      if (discordId) {
        const user = userByDiscordId.get(discordId);
        if (user && discordUsername && user.username.toLowerCase() !== discordUsername.toLowerCase()) {
          validated.errors.push("Discord User ID and Discord Username do not belong to the same account.");
        }
        userId = user?.id ?? null;
      } else if (discordUsername) {
        const matches = usersByUsernameLower.get(discordUsername.toLowerCase()) ?? [];
        if (matches.length > 1) {
          validated.errors.push("Discord Username matches multiple existing accounts. Provide the Discord User ID.");
        } else {
          userId = matches[0]?.id ?? null;
        }
      }
      resolvedUserIds.push(userId);

      const existingByUsername = discordUsername ? memberByUsername.get(discordUsername) : undefined;
      if (discordId) {
        const conflicting = memberByDiscordId.get(discordId);
        if (conflicting && conflicting.id !== existingByUsername?.id) {
          validated.errors.push(`Discord User ID ${discordId} is already assigned to another member in this guild.`);
        }
      }
    }

    const validationErrors = validatedRows.filter((row) => row.errors.length > 0);
    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false, created: 0, updated: 0,
        errors: validationErrors.map((row) => ({
          row: row.rowNumber,
          discordUsername: row.discordUsername,
          errors: row.errors,
        })),
        message: "Import validation failed. No changes were made.",
      });
    }

    const operations = [];
    const operationMeta: { row: number; discordUsername: string; action: "created" | "updated" }[] = [];

    for (let index = 0; index < normalizedRows.length; index++) {
      const row = normalizedRows[index];
      const discordUsername = String(getValue(row, "discordUsername")).trim();
      const existing = memberByUsername.get(discordUsername);
      const userId = resolvedUserIds[index];
      const operation = existing
        ? prisma.guildMember.update({
            where: { id: existing.id },
            data: buildUpdateData(row, userId),
          })
        : prisma.guildMember.create({
            data: buildCreateData(row, guildId, userId),
          });

      operations.push(operation);
      operationMeta.push({ row: index + 2, discordUsername, action: existing ? "updated" : "created" });
    }

    await prisma.$transaction(operations);

    const created = operationMeta.filter((result) => result.action === "created").length;
    const updated = operationMeta.length - created;

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: created + updated,
      errors: [],
      results: operationMeta,
    });
  } catch (error) {
    console.error("[MEMBERS IMPORT]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to import members." }, { status: 500 });
  }
}
