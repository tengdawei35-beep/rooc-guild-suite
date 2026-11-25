export const ROOC_JOBS = [
  "Lord Knight", "Paladin", "High Priest", "Champion", "Sniper", "Bard", "Gypsy", "High Wizard", "Professor", "Assassin Cross", "Stalker", "Mastersmith", "Biochemist (Plant)", "Doram (Physical)", "Gunslinger", "Super Novice", "Doram (Magic)", "Biochemist (Physical)", "Shiranui", "Doram (Support)",
] as const;

export const RO3_JOBS = [
  "Mechanic",
  "Royal Guard (DPS)",
  "Royal Guard (Tank)",
  "Rune Knight (DPS)",
  "Rune Knight (Tank)",
  "Warlock",
  "Ranger",
  "Archbishop",
  "Guillotine Cross",
] as const;

export const RO3_DPS_JOBS = [
  "Mechanic", "Royal Guard (DPS)", "Rune Knight (DPS)", "Warlock", "Ranger", "Guillotine Cross",
] as const;

export const RO3_TANK_JOBS = [
  "Royal Guard (Tank)", "Rune Knight (Tank)",
] as const;

export const RO3_SUPPORT_JOBS = ["Archbishop"] as const;

/** Legacy alias retained for ROOC consumers until game-aware selectors are migrated. */
export const JOBS = ROOC_JOBS;
export type ROOCJob = (typeof ROOC_JOBS)[number];
export type RO3Job = (typeof RO3_JOBS)[number];
export type Job = ROOCJob | RO3Job;

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
  if (!job) return false;
  if (gameType === "RO3") return RO3_DPS_JOBS.includes(job as (typeof RO3_DPS_JOBS)[number]);
  return ROOC_DPS_JOBS.includes(job as (typeof ROOC_DPS_JOBS)[number]);
}

export function isTankOrSupportJobForRo3(job: string | null | undefined): boolean {
  return typeof job === "string" && (
    (RO3_TANK_JOBS as readonly string[]).includes(job) ||
    (RO3_SUPPORT_JOBS as readonly string[]).includes(job)
  );
}
