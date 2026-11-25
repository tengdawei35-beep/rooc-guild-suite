import { Ro3MemoryDataStore, simulateRotation } from "./engine/ro3-damage-engine.mjs";
import type { CombatBuild, CombatDefender, CombatRotationResult } from "./types";

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
