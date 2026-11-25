"use client";

import { useCallback, useEffect, useState } from "react";
import { createRo3CombatDataStore } from "../create-data-store";
import { loadRo3GameData } from "../data/ro3-game-data";
import { getCombatSkillOptions, type CombatSkillOption } from "../skill-options";
import { simulateCombatRotation } from "../simulate";
import type { Ro3MemoryDataStore } from "../engine/ro3-damage-engine.mjs";
import type { CombatBuild, CombatDefender, CombatRotationResult } from "../types";

export type CombatEngineStatus = "loading" | "ready" | "error";

/**
 * Client-side lifecycle for the extracted combat engine.
 * This hook is deliberately not wired into the production page yet; the iframe
 * remains the live UI until all native workflows pass parity checks.
 */
export function useCombatSimulatorEngine() {
  const [data, setData] = useState<Ro3MemoryDataStore | null>(null);
  const [skillOptions, setSkillOptions] = useState<CombatSkillOption[]>([]);
  const [status, setStatus] = useState<CombatEngineStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([createRo3CombatDataStore(), loadRo3GameData()])
      .then(([store, exported]) => {
        if (!active) return;
        setData(store);
        setSkillOptions(getCombatSkillOptions(
          exported.ui as { jobs: Array<{ id: number; parent?: number }>; trees: Record<string, Array<Array<number | null>>> },
          exported.tables.SkillConfig as Record<string, Record<string, unknown>>,
          1410,
        ));
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const simulate = useCallback((
    attacker: CombatBuild,
    defender: CombatDefender,
    rotationSkillIds: number[],
    durationMs = 30000,
  ): CombatRotationResult => {
    if (!data) throw new Error("Combat engine is not ready yet.");
    return simulateCombatRotation(attacker, defender, rotationSkillIds, durationMs, data);
  }, [data]);

  return { status, error, ready: status === "ready", skillOptions, simulate };
}
