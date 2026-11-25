"use client";

import { useCallback, useEffect, useState } from "react";
import { createRo3CombatDataStore } from "../create-data-store";
import { loadRo3GameData } from "../data/ro3-game-data";
import { getCombatSkillOptions, type CombatSkillOption } from "../skill-options";
import { simulateCombatRotation } from "../simulate";
import { buildCharacterStats, gearParts } from "../engine/ro3-damage-engine.mjs";
import { getCombatEquipmentCatalog } from "../equipment-options";
import type { NativeEquipmentSelection } from "../build-input";
import { toEngineEquipment } from "../build-input";
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
  const [equipmentCatalog, setEquipmentCatalog] = useState<ReturnType<typeof getCombatEquipmentCatalog> | null>(null);
  const [status, setStatus] = useState<CombatEngineStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([createRo3CombatDataStore(), loadRo3GameData()])
      .then(([store, exported]) => {
        if (!active) return;
        setData(store);
        setEquipmentCatalog(getCombatEquipmentCatalog(
          exported.tables as Parameters<typeof getCombatEquipmentCatalog>[0],
          exported.ui as Parameters<typeof getCombatEquipmentCatalog>[1],
          1410,
        ));
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

  const getCharacterSheet = useCallback((attacker: CombatBuild, selection: NativeEquipmentSelection) => {
    if (!data || !equipmentCatalog) throw new Error("Combat engine is not ready yet.");
    const mapped = toEngineEquipment(selection, equipmentCatalog.equipment, equipmentCatalog.cards, attacker.level);
    return buildCharacterStats({ ...attacker, ...mapped }, data);
  }, [data, equipmentCatalog]);

  const getGearCustomization = useCallback((id: number, grid: number) => {
    if (!data) return null;
    const parts = gearParts({ id, grid, roll: 5000, affixes: [], stunts: [] }, data);
    if (!parts) return null;
    const attributeNames = data.table("AttributeConfig");
    const specialEffects = data.table("SpecialEffectConfig");
    return {
      affixes: parts.pool.map((row: Record<string, unknown>) => ({
        id: Number(row._iAttriID), name: String(attributeNames[String(row._iAttriID)]?.name ?? `Attribute ${row._iAttriID}`),
        min: Number(row._iMin ?? 0), max: Number(row._iMax ?? 0),
      })),
      affixSlots: Number(parts.slots ?? 0),
      stuntPools: parts.pools.map((pool: number[], index: number) => ({
        chance: Number(parts.chances[index] ?? 0),
        options: pool.map((stuntId) => ({
          id: Number(stuntId), name: String(specialEffects[String(stuntId)]?.tx ?? `Stunt ${stuntId}`),
        })),
      })),
      fixedStunts: parts.fixedStunts.map((stuntId: number) => ({
        id: Number(stuntId), name: String(specialEffects[String(stuntId)]?.tx ?? `Stunt ${stuntId}`),
      })),
    };
  }, [data]);

  const simulate = useCallback((
    attacker: CombatBuild,
    defender: CombatDefender,
    rotationSkillIds: number[],
    durationMs = 30000,
  ): CombatRotationResult => {
    if (!data) throw new Error("Combat engine is not ready yet.");
    return simulateCombatRotation(attacker, defender, rotationSkillIds, durationMs, data);
  }, [data]);

  return { status, error, ready: status === "ready", skillOptions, equipmentCatalog, getCharacterSheet, getGearCustomization, simulate };
}
