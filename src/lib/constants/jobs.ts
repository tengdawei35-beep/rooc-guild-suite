export const ROOC_JOBS = [
  "Lord Knight", "Paladin", "High Priest", "Champion", "Sniper", "Bard", "Gypsy", "High Wizard", "Professor", "Assassin Cross", "Stalker", "Mastersmith", "Biochemist (Plant)", "Doram (Physical)", "Gunslinger", "Super Novice", "Doram (Magic)", "Biochemist (Physical)", "Shiranui", "Doram (Support)",
] as const;

export const RO3_JOBS = [
  "Mechanic", "Royal Guard", "Rune Knight", "Warlock", "Ranger", "Archbishop", "Guillotine Cross",
] as const;

/** Legacy alias retained for ROOC consumers until game-aware selectors are migrated. */
export const JOBS = ROOC_JOBS;
export type ROOCJob = (typeof ROOC_JOBS)[number];
export type RO3Job = (typeof RO3_JOBS)[number];
export type Job = ROOCJob | RO3Job;

/** ROOC-only role classification. RO3 roles are intentionally unclassified until its scoring model is defined. */
export const ROOC_DPS_JOBS = [
  "Lord Knight", "Paladin", "High Wizard", "Sniper", "Assassin Cross", "Stalker",
  "Champion", "Mastersmith", "Biochemist (Physical)", "Doram (Physical)",
  "Gunslinger", "Super Novice", "Doram (Magic)", "Shiranui",
] as const;

export const ROOC_SUPPORT_JOBS = [
  "High Priest", "Bard", "Gypsy", "Professor", "Biochemist (Plant)", "Doram (Support)",
] as const;

export function jobsForGame(gameType: "ROOC" | "RO3") {
  return gameType === "RO3" ? RO3_JOBS : ROOC_JOBS;
}

export function isDpsJobForGame(gameType: "ROOC" | "RO3", job: string | null | undefined): boolean {
  return gameType === "ROOC" && ROOC_DPS_JOBS.includes(job as (typeof ROOC_DPS_JOBS)[number]);
}
