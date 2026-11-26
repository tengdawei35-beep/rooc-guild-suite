"use client";

import { useCallback, useEffect, useState } from "react";
import { createRo3CombatDataStore } from "../create-data-store";
import { loadRo3GameData } from "../data/ro3-game-data";
import { getCombatSkillOptions, type CombatSkillOption } from "../skill-options";
import { simulateCombatRotation } from "../simulate";
import { buildCharacterStats, gearParts, cardParts, talentOptions, talentWalk, talentEffects } from "../engine/ro3-damage-engine.mjs";
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
export type NativePetOption = { id: number; growthId: number; name: string; growthName: string; maxLevel: number };
export type NativeTalentChoice = { id: number; name: string; text?: string; sim?: number; kids: Array<{ id: number; name: string; text?: string; sim?: number }> };

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
  const [petOptions, setPetOptions] = useState<NativePetOption[]>([]);
  const [status, setStatus] = useState<CombatEngineStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([createRo3CombatDataStore(), loadRo3GameData()])
      .then(([store, exported]) => {
        if (!active) return;
        setData(store);
        setPetOptions(Object.values(store.table("PetDigest")).map((row) => {
          const id = Number(row._iID);
          const growthId = Number(row.g);
          const growth = store.row("PetGrowth", growthId);
          const petName = row.main && typeof row.main === "object" ? String((row.main as Record<string, unknown>).name ?? "") : "";
          const passiveName = row.pas && typeof row.pas === "object" ? String((row.pas as Record<string, unknown>).name ?? "") : "";
          return { id, growthId, name: petName || passiveName || "Pet " + id, growthName: String(growth?.name ?? "Growth " + growthId), maxLevel: Number(store.row("PetRules", 1)?.maxLv ?? 100) };
        }).filter((pet) => Number.isFinite(pet.id) && pet.id > 0 && Number.isFinite(pet.growthId) && pet.growthId > 0).sort((a, b) => a.name.localeCompare(b.name)));
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

  const getTalentConfiguration = useCallback((career: number, level: number, prof: number, talents: Record<string, any>): { branches: Array<{ id: string; options: NativeTalentChoice[] }>; walk: Record<string, any> | null; effects: { attrs: Array<[number, number]>; buffs: number[] } } => {
    if (!data) return { branches: [] as Array<{ id: string; options: Array<Record<string, any>> }>, walk: null, effects: { attrs: [], buffs: [] } };
    const digest = data.row("TalentDigest", 1);
    const branches = digest?.branches && typeof digest.branches === "object"
      ? Object.keys(digest.branches as Record<string, unknown>).map((id) => ({
          id,
          options: talentOptions(id, career, prof, data) as NativeTalentChoice[],
        })).filter((branch) => branch.options.length > 0)
      : [];
    const build = { career, level, talents };
    return { branches, walk: talentWalk(build, data), effects: talentEffects(build, data) };
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

  return { status, error, ready: status === "ready", skillOptions, equipmentCatalog, attributeOptions, petOptions, getCharacterSheet, getGearCustomization, getGearLevelCaps, getCardCustomization, getTalentConfiguration, simulate };
}
