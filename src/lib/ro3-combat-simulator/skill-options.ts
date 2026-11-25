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
