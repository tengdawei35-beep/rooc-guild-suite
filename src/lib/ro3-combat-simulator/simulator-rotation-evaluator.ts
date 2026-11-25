import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  persistedRo3StatsToSimulatorAttributes,
  type PersistedRo3Stats,
} from "./persisted-stat-adapter";

type RotationResult = {
  durationMs: number;
  totalExpectedDamage: number;
  sustainedDps: number;
  burst5sDps: number;
  casts: number;
  autoSwings: number;
  groundTicks: number;
  castLog: Array<Record<string, unknown>>;
};

type SimulatorModule = {
  Ro3DataStore: new () => {
    row: (table: string, id: number) => Record<string, unknown> | null;
  };
  buildCharacterStats: (build: Record<string, unknown>, data: unknown) => Record<number, number>;
  simulateRotation: (
    build: Record<string, unknown>,
    defender: Record<string, unknown>,
    rotationSkillIds: number[],
    durationMs: number,
    data: unknown,
  ) => RotationResult;
};

export const RO3_ROTATION_REFERENCE_LEVEL = 99;
export const RO3_ROTATION_REFERENCE_DEFENDER = Object.freeze({
  level: 99, def: 1980, mdef: 1980, element: 1, race: 2, size: 2, flee: 0, resCri: 0,
});

let simulatorPromise: Promise<{
  engineSha256: string;
  data: InstanceType<SimulatorModule["Ro3DataStore"]>;
  buildCharacterStats: SimulatorModule["buildCharacterStats"];
  simulateRotation: SimulatorModule["simulateRotation"];
}> | null = null;

async function loadSimulator() {
  if (!simulatorPromise) {
    simulatorPromise = (async () => {
      const html = await readFile(join(process.cwd(), "src/lib/ro3-combat-simulator/ro3-damage-sim.html"), "utf8");
      const begin = html.indexOf("/* @@ENGINE-BEGIN */");
      const end = html.indexOf("/* @@ENGINE-END */");
      if (begin < 0 || end <= begin) throw new Error("Could not locate the generated RO3 simulator engine.");
      const source = html.slice(begin, end);
      const engineSha256 = createHash("sha256").update(source).digest("hex");
      const encoded = Buffer.from(source, "utf8").toString("base64");
      const engine = await import(`data:text/javascript;base64,${encoded}`) as SimulatorModule;
      return {
        engineSha256,
        data: new engine.Ro3DataStore(),
        buildCharacterStats: engine.buildCharacterStats,
        simulateRotation: engine.simulateRotation,\n      CLASS_PROFILES: engine.CLASS_PROFILES,
      };
    })();
  }
  return simulatorPromise;
}


export type Ro3SimulatorReferenceProfile = {
  profileKey: string;
  heimdallJob: string;
  simulatorProfileName: string;
  careerId: number;
  careerConfigAvailable: boolean;
  passiveSkillIds: number[];
  rotations: Array<{
    name: string;
    skillIds: number[];
    availableSkillIds: number[];
    unavailableSkillIds: number[];
    damageSkillCount: number;
  }>;
  status: "ready-for-review" | "career-config-missing" | "skills-incomplete" | "no-valid-damage-rotation";
  executable: false;
  note: string;
};

const HEIMDALL_PROFILE_MAP: Record<string, string> = {
  mechanic: "Mechanic",
  runeknight: "Rune Knight (DPS)",
  warlock: "Warlock",
  ranger: "Ranger",
  guillotinecross: "Guillotine Cross",
};

/**
 * Discover existing simulator-authored reference rotations without importing
 * the sample gear/totem presets or treating them as validated member builds.
 * Profiles are review-only until their JobConfig and all rotation skill rows
 * are present in the embedded data.
 */
export async function listRo3SimulatorReferenceProfiles(): Promise<Ro3SimulatorReferenceProfile[]> {
  const simulator = await loadSimulator();
  return Object.entries(HEIMDALL_PROFILE_MAP).map(([profileKey, heimdallJob]) => {
    const profile = simulator.CLASS_PROFILES[profileKey];
    if (!profile) {
      return {
        profileKey, heimdallJob, simulatorProfileName: "", careerId: 0,
        careerConfigAvailable: false, passiveSkillIds: [], rotations: [],
        status: "career-config-missing" as const, executable: false as const,
        note: "No matching simulator-authored class profile exists.",
      };
    }
    const careerConfigAvailable = Boolean(simulator.data.row("JobConfig", profile.career));
    const rotations = profile.candidateRotations.map((rotation) => {
      const availableSkillIds = rotation.skills.filter((id) => Boolean(simulator.data.row("SkillConfig", id)));
      const unavailableSkillIds = rotation.skills.filter((id) => !simulator.data.row("SkillConfig", id));
      const damageSkillCount = availableSkillIds.filter((id) => {
        const row = simulator.data.row("SkillConfig", id);
        return Number(row?._iBasicType) === 1 &&
          Array.isArray(row?._kDamageParam1) && row._kDamageParam1.length > 0;
      }).length;
      return {
        name: rotation.name,
        skillIds: [...rotation.skills],
        availableSkillIds,
        unavailableSkillIds,
        damageSkillCount,
      };
    });
    const allSkillsAvailable = rotations.every((r) => r.unavailableSkillIds.length === 0);
    const hasDamageRotation = rotations.some((r) => r.damageSkillCount > 0);
    const status = !careerConfigAvailable
      ? "career-config-missing" as const
      : !allSkillsAvailable
        ? "skills-incomplete" as const
        : !hasDamageRotation
          ? "no-valid-damage-rotation" as const
          : "ready-for-review" as const;
    return {
      profileKey,
      heimdallJob,
      simulatorProfileName: profile.name,
      careerId: profile.career,
      careerConfigAvailable,
      passiveSkillIds: [...(profile.passiveSkills ?? [])],
      rotations,
      status,
      executable: false as const,
      note: "Simulator-authored candidate only. Sample equipment, cards, pets, totems and buffs are deliberately not imported. Human review is required before treating this as a job reference rotation.",
    };
  });
}
\nexport type Ro3RotationEvaluation = {
  version: "RO3_SIMULATOR_ROTATION_V1";
  engineSha256: string;
  careerId: number;
  referenceLevel: 99;
  defender: typeof RO3_ROTATION_REFERENCE_DEFENDER;
  durationMs: number;
  rotationSkillIds: number[];
  sustainedDps: number;
  burst5sDps: number;
  totalExpectedDamage: number;
  casts: number;
  autoSwings: number;
  groundTicks: number;
  skippedSkills: Array<{ skillId: number; reason: string }>;
  excludedPersistedStats: Array<{ key: string; reason: string }>;
  score: null;
  note: string;
};

/**
 * Runs an explicitly supplied skill priority/cycle through the simulator's
 * actual rotation scheduler. The persisted stat values are reconciled against
 * the simulator's Level 99 career sheet so they are treated as final sheet
 * values rather than being added on top of a second set of base stats.
 */
export async function evaluateRo3Rotation(input: {
  stats: PersistedRo3Stats;
  careerId: number;
  skillIds: number[];
  durationMs?: number;
  passiveSkillIds?: number[];
}): Promise<Ro3RotationEvaluation> {
  if (!Number.isInteger(input.careerId) || input.careerId <= 0) {
    throw new Error("A valid simulator JobConfig careerId is required; job labels are not mapped to career IDs.");
  }
  const durationMs = input.durationMs ?? 30000;
  if (!Number.isInteger(durationMs) || durationMs < 5000 || durationMs > 120000) {
    throw new Error("Rotation duration must be an integer between 5,000 and 120,000 milliseconds.");
  }

  const simulator = await loadSimulator();
  const adapted = persistedRo3StatsToSimulatorAttributes(input.stats);
  const baseBuild: Record<string, unknown> = {
    career: input.careerId,
    level: RO3_ROTATION_REFERENCE_LEVEL,
    stats: [1, 1, 1, 1, 1, 1],
    cards: [],
    gear: [],
    pets: [],
    assistPets: [],
    activeBuffs: [],
    passiveSkills: input.passiveSkillIds ?? [],
    extraAttrs: [],
    rotationCycle: true,
  };
  if (!simulator.data.row("JobConfig", input.careerId)) {\n    throw new Error(`Simulator JobConfig career ${input.careerId} is missing; refusing to use the simulator fallback career sheet.`);\n  }\n  const baseSheet = simulator.buildCharacterStats(baseBuild, simulator.data);
  const extraAttrs = Object.entries(adapted.attributes).map(([rawId, value]) => {
    const id = Number(rawId);
    return [id, Number(value) - Number(baseSheet[id] ?? 0)];
  });
  const build = { ...baseBuild, extraAttrs };

  const validSkillIds: number[] = [];
  const skippedSkills: Ro3RotationEvaluation["skippedSkills"] = [];
  const seen = new Set<number>();
  for (const rawId of input.skillIds) {
    const skillId = Number(rawId);
    if (!Number.isInteger(skillId) || skillId <= 0 || seen.has(skillId)) continue;
    seen.add(skillId);
    const row = simulator.data.row("SkillConfig", skillId);
    if (!row || Number(row._iBasicType) !== 1) {
      skippedSkills.push({ skillId, reason: "Skill ID is missing or is not an active simulator skill." });
      continue;
    }
    validSkillIds.push(skillId);
  }
  const hasDamageSkill = validSkillIds.some((id) => {
    const row = simulator.data.row("SkillConfig", id);
    return Array.isArray(row?._kDamageParam1) && row._kDamageParam1.length > 0;
  });
  if (!hasDamageSkill) throw new Error("At least one valid damage skill is required in the rotation.");

  const result = simulator.simulateRotation(
    build,
    { ...RO3_ROTATION_REFERENCE_DEFENDER },
    validSkillIds,
    durationMs,
    simulator.data,
  );
  return {
    version: "RO3_SIMULATOR_ROTATION_V1",
    engineSha256: simulator.engineSha256,
    careerId: input.careerId,
    referenceLevel: RO3_ROTATION_REFERENCE_LEVEL,
    defender: RO3_ROTATION_REFERENCE_DEFENDER,
    durationMs: result.durationMs,
    rotationSkillIds: validSkillIds,
    sustainedDps: result.sustainedDps,
    burst5sDps: result.burst5sDps,
    totalExpectedDamage: result.totalExpectedDamage,
    casts: result.casts,
    autoSwings: result.autoSwings,
    groundTicks: result.groundTicks,
    skippedSkills,
    excludedPersistedStats: adapted.excluded.map(({ key, reason }) => ({ key, reason })),
    score: null,
    note: "Simulator-authoritative rotation estimate using the supplied skill cycle and persisted sheet stats. It is not a normalized member score or a job-default build. Equipment, cards, pets, buffs and passives are included only when explicitly supplied; no job-to-career mapping is inferred.",
  };
}
