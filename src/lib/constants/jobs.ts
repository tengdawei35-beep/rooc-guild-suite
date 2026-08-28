export const JOBS = [
  "Lord Knight",
  "Paladin",
  "High Priest",
  "Champion",
  "Sniper",
  "Bard",
  "Gypsy",
  "High Wizard",
  "Professor",
  "Assassin Cross",
  "Stalker",
  "Mastersmith",
  "Biochemist (Plant)",
  "Doram (Physical)",
  "Gunslinger",
  "Super Novice",
  "Doram (Magic)",
  "Biochemist (Physical)",
  "Shiranui",
  "Doram (Support)",
] as const;

export type Job = (typeof JOBS)[number];