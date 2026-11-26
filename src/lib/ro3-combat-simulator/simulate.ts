import { simulateRotation, simulateDistribution } from "./engine/ro3-damage-engine.mjs";
import type { Ro3MemoryDataStore } from "./engine/ro3-damage-engine.mjs";
import type { CombatBuild, CombatDefender, CombatRotationResult, CombatDistributionResult } from "./types";

/**
 * Framework-independent adapter used by the future native React workspace.
 * All calculations are delegated to the extracted engine without changing
 * its formulas, rounding, timing or rotation behaviour.
 */
export function simulateCombatRotation(
  attacker: CombatBuild,
  defender: CombatDefender,
  rotationSkillIds: number[],
  durationMs: number,
  data: Ro3MemoryDataStore,
): CombatRotationResult {
  return simulateRotation(attacker, defender, rotationSkillIds, durationMs, data) as CombatRotationResult;
}

export type CombatDistributionOptions = {
  runs: number;
  seed: number;
  bins?: number;
  bucketMs?: number;
  captureRun?: boolean;
};

/** Uses the legacy engine's seeded Monte Carlo distribution over its deterministic cast timeline. */
export function simulateCombatDistribution(
  attacker: CombatBuild,
  defender: CombatDefender,
  rotationSkillIds: number[],
  durationMs: number,
  options: CombatDistributionOptions,
  data: Ro3MemoryDataStore,
): CombatDistributionResult {
  return simulateDistribution(attacker, defender, rotationSkillIds, durationMs, options, data) as CombatDistributionResult;
}
