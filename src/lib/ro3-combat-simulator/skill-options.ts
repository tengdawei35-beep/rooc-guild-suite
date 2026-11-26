export type CombatSkillOption = { id: number; groupId: number; name: string; level: number; jobId: number };

/** Mirrors the legacy simulator's job-tree grouping: only learnable rows in the selected job's ancestry are offered. */
export function getCombatSkillOptions(
  ui: { jobs: Array<{ id: number; parent?: number }>; trees: Record<string, Array<Array<number | null>>> },
  skillTable: Record<string, Record<string, unknown>>,
  career: number,
): CombatSkillOption[] {
  const jobs = new Map(ui.jobs.map((job) => [Number(job.id), job]));
  const chain: number[] = [];
  for (let current = jobs.get(career); current; current = jobs.get(Number(current.parent))) {
    chain.unshift(Number(current.id));
  }
  const groupJob = new Map<number, number>();
  for (const [job, rows] of Object.entries(ui.trees)) {
    for (const row of rows) for (const group of row) {
      if (group != null && Number(group) > 0) groupJob.set(Number(group), Number(job));
    }
  }
  const allowedJobs = new Set(chain);
  const groups = new Map<number, CombatSkillOption>();
  for (const row of Object.values(skillTable)) {
    const groupId = Number(row._iSkillID);
    const jobId = groupJob.get(groupId);
    const level = Number(row._iLevel);
    if (!jobId || !allowedJobs.has(jobId) || !Number.isInteger(level) || level < 1 || row._bAlt) continue;
    if (Number(row._iBasicType) !== 1 || !Array.isArray(row._kDamageParam1) || row._kDamageParam1.length === 0) continue;
    const id = Number(row._iID);
    if (!Number.isSafeInteger(id)) continue;
    const existing = groups.get(groupId);
    if (!existing || level > existing.level) {
      groups.set(groupId, {
        id, groupId, name: String(row.name ?? `Skill ${groupId}`), level, jobId,
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

import { BUFF_PROCS, RIDING_PASSIVES } from "./engine/ro3-damage-engine.mjs";

const FX_ATTRS = new Set([1,2,3,4,5,6,102,103,104,109,111,114,115,209,211,213,215,227,229,235,1021,1022,1023,1031,1032,1033,1034,1041,1042,1043,1044,1091,1092,1093,1111,1112,1113,1141,1142,1211,1213,1215,1227,1229,1250,1252]);
const SKILL_FX_TYPES = new Set([0,21,23,24,25,26,27,29,30]);

function hasModeledBuffEffect(id: number, buffTable: Record<string, Record<string, unknown>>): boolean {
  const config = buffTable[String(id)];
  if (!config) return false;
  if (Boolean(BUFF_PROCS[Math.floor(id / 100)])) return true;
  const attrs = Array.isArray(config._kChangeAttri) ? config._kChangeAttri : [];
  if (attrs.some((entry) => Array.isArray(entry) && FX_ATTRS.has(Number(entry[0])))) return true;
  const skillAttrs = Array.isArray(config._kSkillAttributeList) ? config._kSkillAttributeList : [];
  return skillAttrs.some((entry) => Array.isArray(entry) && (Number(entry[0]) === 0 || (Number(entry[0]) === 1 && Number(entry[1]) > 0)) && SKILL_FX_TYPES.has(Number(entry[2])));
}

export type CombatSkillTreeOption = {
  groupId: number;
  name: string;
  jobId: number;
  maxLevel: number;
  kind: "damage" | "buff" | "passive" | "utility";
  levels: Array<{ level: number; rowId: number; buffs: Array<{ id: number; durationMs: number; modeled: boolean }>; passive: boolean }>;\n  autoBuff: boolean;\n  rotationUsable: boolean;
};

export function getCombatSkillTreeOptions(
  ui: { jobs: Array<{ id: number; parent?: number }>; trees: Record<string, Array<Array<number | null>>> },
  skillTable: Record<string, Record<string, unknown>>,
  career: number,
): CombatSkillTreeOption[] {
  const jobs = new Map(ui.jobs.map((job) => [Number(job.id), job]));
  const chain: number[] = [];
  for (let current = jobs.get(career); current; current = jobs.get(Number(current.parent))) chain.unshift(Number(current.id));
  const groupJob = new Map<number, number>();
  for (const [job, rows] of Object.entries(ui.trees)) for (const row of rows) for (const group of row) {
    if (group != null && Number(group) > 0) groupJob.set(Number(group), Number(job));
  }
  const grouped = new Map<number, Record<string, unknown>[]>();
  for (const row of Object.values(skillTable)) {
    const group = Number(row._iSkillID);
    const level = Number(row._iLevel);
    if (!groupJob.has(group) || !chain.includes(groupJob.get(group)!) || !Number.isInteger(level) || level < 1 || row._bAlt) continue;
    const rows = grouped.get(group) ?? [];
    rows.push(row);
    grouped.set(group, rows);
  }
  return [...grouped.entries()].map(([groupId, rows]) => {
    rows.sort((a,b)=>Number(a._iLevel)-Number(b._iLevel));
    const top = rows[rows.length-1];
    const basicType = Number(top._iBasicType);
    const kind = basicType === 0 ? (Array.isArray(top._kAttri) && top._kAttri.length ? "passive" : "utility")
      : Array.isArray(top._kDamageParam1) && top._kDamageParam1.length ? "damage"
      : Array.isArray(top._kBuff1) && top._kBuff1.length ? "buff" : "utility";
    return {
      groupId, name: String(top.name ?? rows[0].name ?? `Skill ${groupId}`),
      jobId: groupJob.get(groupId)!, maxLevel: Number(top._iLevel), kind,
      levels: rows.map(row => ({
        level: Number(row._iLevel), rowId: Number(row._iID),
        buffs: (Array.isArray(row._kBuff1) ? row._kBuff1 : []).filter((entry): entry is number[] => Array.isArray(entry))
          .map(entry => ({id:Number(entry[0]),durationMs:Number(entry[2])>0?Number(entry[2]):60000})).filter(entry=>entry.id>0),
        passive: Number(row._iBasicType)===0 && Array.isArray(row._kAttri) && row._kAttri.length>0,
      })),
    } satisfies CombatSkillTreeOption;
  }).sort((a,b)=>a.name.localeCompare(b.name)||a.groupId-b.groupId);
}

export function deriveLearnedSkillEffects(
  options: CombatSkillTreeOption[],
  learnedLevels: Record<string, number>,
  buffTable: Record<string, Record<string, unknown>>,
): { passiveSkillIds: number[]; autoBuffIds: number[] } {
  const passiveSkillIds: number[] = [];
  const autoBuffIds = new Set<number>();
  for (const option of options) {
    const level = Math.max(0, Math.min(option.maxLevel, Math.trunc(Number(learnedLevels[String(option.groupId)] ?? 0))));
    if (!level) continue;
    const row = option.levels.find(item=>item.level===level);
    if (!row) continue;
    if (row.passive) passiveSkillIds.push(row.rowId);
    if (option.kind !== "buff") continue;
    for (const buff of row.buffs) {
      if (buff.durationMs < 60000) continue;
      const config = buffTable[String(buff.id)];
      if (!config) continue;
      const changes = Array.isArray(config._kChangeAttri) && config._kChangeAttri.length > 0;
      const skillChanges = Array.isArray(config._kSkillAttributeList) && config._kSkillAttributeList.length > 0;
      if (changes || skillChanges) autoBuffIds.add(buff.id);
    }
  }
  return {passiveSkillIds: [...new Set(passiveSkillIds)], autoBuffIds: [...autoBuffIds]};
}
