import type { NativeEquipmentSelection } from "./build-input";

export const NATIVE_BUILD_STORAGE_KEY = "hmdl.ro3.native-builds.v1";
export const MAX_NATIVE_SAVED_BUILDS = 8;

export type NativeBuildDraft = {
  level: string;
  stats: string[];
  equipment: NativeEquipmentSelection;
  pets: Array<{ id: number; lv: number; star: number; stage: number } | null>;
  assistPets: Array<{ g: number; lv: number; star: number; stage: number } | null>;
  enchantAttrs: Array<[number, number]>;
  emblemAttrInput: string;
  totemSkillIds: string;
  totemAttrInput: string;
  totemEnhanceBp: string;
  resonanceRefine: string;
  resonanceEnhance: string;
  talentLevel: string;
  talentProf: string;
  talentPicks: Record<string, [number, number]>;
  passiveSkillIds: string;
  talentSkillLevels: string;
  activeBuffIds: string;
  skillLevels: string;
  rotationCycle: boolean;
  cancelBackswing: boolean;
  periodicOff: boolean;
  periodicStartSeconds: string;
  ridden: boolean;
  def: string;
  mdef: string;
  targetLevel: string;
  element: string;
  race: string;
  size: string;
  skillIds: string;
  duration: string;
};

export type NativeSavedBuild = {
  id: string;
  name: string;
  updatedAt: string;
  state: NativeBuildDraft;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isPairArray = (value: unknown): value is Array<[number, number]> =>
  Array.isArray(value) && value.every((pair) => Array.isArray(pair) && pair.length === 2 && isNumber(pair[0]) && isNumber(pair[1]));

function isEquipment(value: unknown): value is NativeEquipmentSelection {
  if (!isRecord(value) || !Array.isArray(value.gear) || value.gear.length !== 7 || !Array.isArray(value.cards) || value.cards.length !== 18) return false;
  const gearValid = value.gear.every((slot) => isRecord(slot)
    && ["id", "roll", "refine", "enhance", "offRefine", "offEnhance"].every((key) => isNumber(slot[key]))
    && Array.isArray(slot.affixes) && slot.affixes.every(isNumber)
    && Array.isArray(slot.stunts) && slot.stunts.every(isNumber));
  const cardsValid = value.cards.every((slot) => isRecord(slot)
    && ["id", "star", "level"].every((key) => isNumber(slot[key]))
    && (slot.flash === undefined || typeof slot.flash === "boolean"));
  return gearValid && cardsValid;
}

export function isNativeBuildDraft(value: unknown): value is NativeBuildDraft {
  if (!isRecord(value) || !isString(value.level) || !isStringArray(value.stats) || value.stats.length !== 6 || !isEquipment(value.equipment)) return false;
  const petArray = (v: unknown, key: "id" | "g") => Array.isArray(v) && v.every((slot) => slot === null || (isRecord(slot)
    && isNumber(slot[key]) && isNumber(slot.lv) && isNumber(slot.star) && isNumber(slot.stage)));
  const stringFields = [
    "emblemAttrInput", "totemSkillIds", "totemAttrInput", "totemEnhanceBp", "resonanceRefine",
    "resonanceEnhance", "talentLevel", "talentProf", "passiveSkillIds", "talentSkillLevels",
    "activeBuffIds", "skillLevels", "periodicStartSeconds",
    "def", "mdef", "targetLevel", "element", "race", "size", "skillIds", "duration",
  ];
  if (!stringFields.every((key) => isString(value[key]))) return false;
  if (!["rotationCycle", "cancelBackswing", "periodicOff", "ridden"].every((key) => typeof value[key] === "boolean")) return false;
  if (!petArray(value.pets, "id") || !petArray(value.assistPets, "g") || !isPairArray(value.enchantAttrs)) return false;
  if (!isRecord(value.talentPicks)) return false;
  return Object.values(value.talentPicks).every((pick) => Array.isArray(pick) && pick.length === 2 && pick.every(isNumber));
}

export function parseNativeSavedBuilds(raw: string | null): NativeSavedBuild[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.builds)) return [];
    const seen = new Set<string>();
    return parsed.builds.flatMap((entry): NativeSavedBuild[] => {
      if (!isRecord(entry) || !isString(entry.id) || !entry.id || seen.has(entry.id)
        || !isString(entry.name) || !entry.name.trim() || !isString(entry.updatedAt)
        || !isNativeBuildDraft(entry.state)) return [];
      seen.add(entry.id);
      return [{ id: entry.id, name: entry.name.slice(0, 40), updatedAt: entry.updatedAt, state: entry.state }];
    }).slice(0, MAX_NATIVE_SAVED_BUILDS);
  } catch {
    return [];
  }
}

export function serializeNativeSavedBuilds(builds: NativeSavedBuild[]): string {
  return JSON.stringify({ version: 1, builds: builds.slice(0, MAX_NATIVE_SAVED_BUILDS) });
}

export function upsertNativeSavedBuild(builds: NativeSavedBuild[], build: NativeSavedBuild): NativeSavedBuild[] {
  return [build, ...builds.filter((item) => item.id !== build.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_NATIVE_SAVED_BUILDS);
}

export function removeNativeSavedBuild(builds: NativeSavedBuild[], id: string): NativeSavedBuild[] {
  return builds.filter((build) => build.id !== id);
}
