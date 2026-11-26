"use client";

import { useCallback, useEffect, useState } from "react";
import { createRo3CombatDataStore } from "../create-data-store";
import { loadRo3GameData } from "../data/ro3-game-data";
import { getCombatSkillOptions, type CombatSkillOption } from "../skill-options";
import { simulateCombatRotation } from "../simulate";
import { buildCharacterStats, gearParts, cardParts } from "../engine/ro3-damage-engine.mjs";
import { getCombatEquipmentCatalog } from "../equipment-options";
import type { NativeEquipmentSelection, GearLevelCaps } from "../build-input";
import { toEngineEquipment } from "../build-input";
import type { Ro3MemoryDataStore } from "../engine/ro3-damage-engine.mjs";
import type { CombatBuild, CombatDefender, CombatRotationResult } from "../types";

export type GearCustomization = {
  affixes: Array<{ id: number; name: string; min: number; max: number }>;
  affixSlots: number;
  stuntPools: Array<{ chance: number; options: Array<{ id: number; name: string }> }>;
  fixedStunts: Array<{ id: number; name: string }>;
};

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
  const [attributeOptions, setAttributeOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [status, setStatus] = useState<CombatEngineStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([createRo3CombatDataStore(), loadRo3GameData()])
      .then(([store, exported]) => {
        if (!active) return;
        setData(store);
        setAttributeOptions(Object.values(store.table("AttributeConfig")).map((row) => ({ id: Number(row._iID), name: String(row.name ?? `Attribute ${row._iID}`) })).filter((row) => Number.isFinite(row.id)).sort((a, b) => a.id - b.id));
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
    const mapped = toEngineEquipment(selection, equipmentCatalog.equipment, equipmentCatalog.cards, attacker.level, getGearLevelCaps(attacker.level));
    return buildCharacterStats({ ...attacker, ...mapped }, data);
  }, [data, equipmentCatalog]);

  const getGearLevelCaps = useCallback((baseLevel: number): GearLevelCaps => {
    if (!data) return { refine: Array(7).fill(0), enhance: Array(7).fill(0) };
    const cap = (tableName: string, key: string) => Array.from({ length: 7 }, (_, index) => {
      const needs = Object.values(data.table(tableName)).filter((row) => Number(row._iEquipType) === index + 1)
        .reduce((rows, row) => { rows[Number(row[key])] = Number(row._iLev); return rows; }, [] as number[]);
      return needs.reduce((top, requiredLevel, level) => requiredLevel <= baseLevel ? level : top, 0);
    });
    return { refine: cap("RefiningTable", "_iRefiningInterval"), enhance: cap("StrengthenTable", "_iStrengthenInterval") };
  }, [data]);

  const getCardCustomization = useCallback((id: number, star: number) => {
    if (!data) return { maxLevel: [5, 10, 15, 15][Math.max(0, Math.min(3, star))], hasCollection: false };
    const parts = cardParts({ id, star, level: 0 }, data);
    return {
      maxLevel: [5, 10, 15, 15][Math.max(0, Math.min(3, star))],
      hasCollection: !!parts?.collectionAttrs?.length,
    };
  }, [data]);

  const getGearCustomization = useCallback((id: number, grid: number): GearCustomization | null => {
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

  return { status, error, ready: status === "ready", skillOptions, equipmentCatalog, attributeOptions, getCharacterSheet, getGearCustomization, getGearLevelCaps, getCardCustomization, simulate };
}
