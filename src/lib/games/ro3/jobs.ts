/** RO3 job catalogue. Extend this list as RO3 adds jobs. */
export const RO3_JOBS = [
  "Mechanic",
  "Royal Guard",
  "Rune Knight",
  "Warlock",
  "Ranger",
  "Archbishop",
  "Guillotine Cross",
] as const;

export type RO3Job = (typeof RO3_JOBS)[number];

export function isRO3Job(value: unknown): value is RO3Job {
  return typeof value === "string" && RO3_JOBS.includes(value as RO3Job);
}
