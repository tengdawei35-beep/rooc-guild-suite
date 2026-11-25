import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  persistedRo3StatsToSimulatorAttributes,
  type PersistedRo3Stats,
} from "./persisted-stat-adapter";

type DamageResult = {
  skillId: number;
  skillName: string;
  magic: boolean;
  expectedPerCast: number;
  instantDps: number;
  hitRate: number;
  critRate: number;
  atkStat: number;
  timing: { chantMs: number; actionMs: number; castLockMs: number; cdMs: number };
};

type SimulatorModule = {
  Ro3DataStore: new () => unknown;
  evaluateSkillDamage: (
    build: Record<string, unknown>,
    defender: Record<string, unknown>,
    skillRow: Record<string, unknown>,
    options: { stats: Record<number, number>; rulesApplied?: boolean },
    data: unknown,
  ) => DamageResult;
};

export const RO3_DPS_REFERENCE_LEVEL = 99;
export const RO3_DPS_REFERENCE_DEFENDER = Object.freeze({
  level: 99,
  def: 1980,
  mdef: 1980,
  element: 1,
  race: 2,
  size: 2,
  flee: 0,
  resCri: 0,
});

let simulatorPromise: Promise<{
  engineSha256: string;
  data: unknown;
  evaluateSkillDamage: SimulatorModule["evaluateSkillDamage"];
}> | null = null;

async function loadSimulator() {
  if (!simulatorPromise) {
    simulatorPromise = (async () => {
      const html = await readFile(new URL("./ro3-damage-sim.html", import.meta.url), "utf8");
      const begin = html.indexOf("/* @@ENGINE-BEGIN */");
      const end = html.indexOf("/* @@ENGINE-END */");
      if (begin < 0 || end <= begin) {
        throw new Error("Could not locate the generated RO3 simulator engine.");
      }
      const source = html.slice(begin, end);
      const engineSha256 = createHash("sha256").update(source).digest("hex");
      const encoded = Buffer.from(source, "utf8").toString("base64");
      const engine = await import(`data:text/javascript;base64,${encoded}`) as SimulatorModule;
      return {
        engineSha256,
        data: new engine.Ro3DataStore(),
        evaluateSkillDamage: engine.evaluateSkillDamage,
      };
    })();
  }
  return simulatorPromise;
}

function completeAttributes(attributes: Record<number, number>) {
  const result = Object.fromEntries(
    Array.from({ length: 1301 }, (_, id) => [id, 0]),
  ) as Record<number, number>;
  Object.assign(result, attributes);
  return result;
}

export type Ro3DpsSkillEvaluation = {
  skillId: number;
  skillName: string;
  channel: "PHYSICAL" | "MAGIC";
  expectedDamagePerCast: number;
  simulatorInstantDps: number;
  hitRate: number;
  critRate: number;
  attackStat: number;
  castLockMs: number;
  cooldownMs: number;
};

export type Ro3DpsProfileEvaluation = {
  version: "RO3_SIMULATOR_DPS_V1";
  engineSha256: string;
  referenceLevel: 99;
  defender: typeof RO3_DPS_REFERENCE_DEFENDER;
  skills: Ro3DpsSkillEvaluation[];
  skippedSkills: Array<{ skillId: number; reason: string }>;
  excludedPersistedStats: Array<{ key: string; reason: string }>;
  score: null;
  note: string;
};

/**
 * Evaluates persisted member stats against real SkillConfig rows using the
 * exact generated simulator engine. Results are per-skill outputs, not a
 * fabricated rotation or a normalized 0–100 member score.
 *
 * Supply the skill IDs for the character's selected reference skill set.
 * Temporary buffs, cards, pets, totems and unpersisted build details are not
 * inferred; the fixed Level 99 reference target is held constant.
 */
export async function evaluateRo3DpsProfile(input: {
  stats: PersistedRo3Stats;
  skillIds: number[];
}): Promise<Ro3DpsProfileEvaluation> {
  const simulator = await loadSimulator();
  const adapted = persistedRo3StatsToSimulatorAttributes(input.stats);
  const stats = completeAttributes(adapted.attributes);
  const build = { level: RO3_DPS_REFERENCE_LEVEL, element: 1, activeBuffs: [], cards: [], totems: [] };
  const skills: Ro3DpsSkillEvaluation[] = [];
  const skippedSkills: Ro3DpsProfileEvaluation["skippedSkills"] = [];
  const seen = new Set<number>();

  for (const rawId of input.skillIds) {
    const skillId = Number(rawId);
    if (!Number.isInteger(skillId) || skillId <= 0 || seen.has(skillId)) continue;
    seen.add(skillId);

    const skillRow = (simulator.data as { row: (table: string, id: number) => Record<string, unknown> | null })
      .row("SkillConfig", skillId);
    if (!skillRow) {
      skippedSkills.push({ skillId, reason: "Skill ID is not present in the simulator SkillConfig data." });
      continue;
    }
    if (Number(skillRow._iBasicType) !== 1 || !Array.isArray(skillRow._kDamageParam1)) {
      skippedSkills.push({ skillId, reason: "The selected SkillConfig row is not an active damage skill." });
      continue;
    }

    const result = simulator.evaluateSkillDamage(
      build,
      { ...RO3_DPS_REFERENCE_DEFENDER },
      skillRow,
      { stats, rulesApplied: false },
      simulator.data,
    );
    skills.push({
      skillId,
      skillName: result.skillName,
      channel: result.magic ? "MAGIC" : "PHYSICAL",
      expectedDamagePerCast: result.expectedPerCast,
      simulatorInstantDps: result.instantDps,
      hitRate: result.hitRate,
      critRate: result.critRate,
      attackStat: result.atkStat,
      castLockMs: result.timing.castLockMs,
      cooldownMs: result.timing.cdMs,
    });
  }

  return {
    version: "RO3_SIMULATOR_DPS_V1",
    engineSha256: simulator.engineSha256,
    referenceLevel: RO3_DPS_REFERENCE_LEVEL,
    defender: RO3_DPS_REFERENCE_DEFENDER,
    skills,
    skippedSkills,
    excludedPersistedStats: adapted.excluded.map(({ key, reason }) => ({ key, reason })),
    score: null,
    note: "Simulator-authoritative per-skill damage outputs. Not a combined rotation DPS or normalized member score; skill selection and rotation must be supplied separately.",
  };
}
