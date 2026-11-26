"use client";

import { useCallback, useEffect, useState } from "react";
import { createRo3CombatDataStore } from "../create-data-store";
import { loadRo3GameData } from "../data/ro3-game-data";
import { getCombatSkillOptions, getCombatSkillTreeOptions, deriveLearnedSkillEffects, type CombatSkillOption, type CombatSkillTreeOption } from "../skill-options";
import { simulateCombatRotation, simulateCombatDistribution, type CombatDistributionOptions } from "../simulate";
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
  const [skillTreeOptions, setSkillTreeOptions] = useState<CombatSkillTreeOption[]>([]);
  const [equipmentCatalog, setEquipmentCatalog] = useState<ReturnType<typeof getCombatEquipmentCatalog> | null>(null);
  const [attributeOptions, setAttributeOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [petOptions, setPetOptions] = useState<NativePetOption[]>([]);
  const [status, setStatus] = useState<CombatEngineStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [exportedData, setExportedData] = useState<any>(null);
  const [careerOptions, setCareerOptions] = useState<Array<{id:number;name:string}>>([]);
  const [namedOptions, setNamedOptions] = useState<{elements:Array<{id:number;name:string}>;races:Array<{id:number;name:string}>;sizes:Array<{id:number;name:string}>;buffs:Array<{id:number;name:string}>;totemSkills:Array<{id:number;name:string}>}>(()=>({elements:[],races:[],sizes:[],buffs:[],totemSkills:[]}));

  useEffect(() => {
    let active = true;
    Promise.all([createRo3CombatDataStore(), loadRo3GameData()])
      .then(([store, exported]) => {
        if (!active) return;
        setData(store);
        setExportedData(exported);
        const tableOptions = (tableName: string, nameKeys = ["name", "tx", "_sName"]) => Object.values(exported.tables[tableName] ?? {}).map((row: any) => ({ id: Number(row._iID), name: String(nameKeys.map((key)=>row[key]).find((value)=>typeof value === "string" && value.trim()) ?? `${tableName} ${row._iID}`) })).filter((row)=>Number.isFinite(row.id)).sort((a,b)=>a.name.localeCompare(b.name));
        setCareerOptions(Object.values(exported.tables.JobConfig ?? {}).map((row: any)=>({id:Number(row._iID),name:String(row.name ?? `Job ${row._iID}`)})).filter((row)=>Number.isFinite(row.id)).sort((a,b)=>a.name.localeCompare(b.name)));
        setNamedOptions({
          elements: [{id:0,name:"Neutral"}, ...Object.values(exported.tables.EleConfig ?? {}).map((row:any)=>({id:Number(row._iID),name:String(row.name ?? ["","Wind","Earth","Fire","Water","Poison","Holy","Shadow","Ghost","Undead"][Number(row._iID)] ?? `Element ${row._iID}`)}))].filter((row)=>Number.isFinite(row.id)),
          races: tableOptions("RaceConfig"), sizes: tableOptions("SizeConfig"), buffs: tableOptions("BuffConfig"), totemSkills: tableOptions("TotemSkillConfig"),
        });
        setPetOptions(Object.values(store.table("PetDigest")).map((row) => {
          const id = Number(row._iID);
          const growthId = Number(row.g);
          const growth = store.row("PetGrowth", growthId);
          const configuredPetName = [row.name, row.petName, row._sName, row._sPetName].find((value) => typeof value === "string" && value.trim());
          const growthName = String(growth?.name ?? "Pet " + id);
          // PetDigest.main/pas are skill payloads; never use their skill names as pet labels.
          return { id, growthId, name: String(configuredPetName ?? growthName), growthName, maxLevel: Number(store.row("PetRules", 1)?.maxLv ?? 100) };
        }).filter((pet) => Number.isFinite(pet.id) && pet.id > 0 && Number.isFinite(pet.growthId) && pet.growthId > 0).sort((a, b) => a.name.localeCompare(b.name)));
        setAttributeOptions(Object.values(store.table("AttributeConfig")).map((row) => ({ id: Number(row._iID), name: String(row.name ?? `Attribute ${row._iID}`) })).filter((row) => Number.isFinite(row.id)).sort((a, b) => a.id - b.id));
        setEquipmentCatalog(getCombatEquipmentCatalog(
          exported.tables as Parameters<typeof getCombatEquipmentCatalog>[0],
          exported.ui as Parameters<typeof getCombatEquipmentCatalog>[1],
          1410,
        ));
        setSkillTreeOptions(getCombatSkillTreeOptions(
          exported.ui as { jobs: Array<{ id: number; parent?: number }>; trees: Record<string, Array<Array<number | null>>> },
          exported.tables.SkillConfig as Record<string, Record<string, unknown>>,
          1410,
          exported.tables.BuffConfig as Record<string, Record<string, unknown>>,
        ));
        setSkillOptions(getCombatSkillOptions(
          exported.ui as { jobs: Array<{ id: number; parent?: number }>; trees: Record<string, Array<Array<number | null>>> },
          exported.tables.SkillConfig as Record<string, Record<string, unknown>>,
          1410,
          exported.tables.BuffConfig as Record<string, Record<string, unknown>>,
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

  const configureCareer = useCallback((career: number) => {
    if (!exportedData) return;
    setEquipmentCatalog(getCombatEquipmentCatalog(exportedData.tables, exportedData.ui, career));
    setSkillTreeOptions(getCombatSkillTreeOptions(exportedData.ui, exportedData.tables.SkillConfig ?? {}, career, exportedData.tables.BuffConfig ?? {}));
    setSkillOptions(getCombatSkillOptions(exportedData.ui, exportedData.tables.SkillConfig ?? {}, career, exportedData.tables.BuffConfig ?? {}));
  }, [exportedData]);

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

  const getTotemEnhanceBp = useCallback((level: number) => {
    if (!data) return 0;
    return Number(data.row("TotemLvConfig", level)?._iAttributeEnhance ?? 0);
  }, [data]);

  const getTotemLevelForEnhanceBp = useCallback((enhanceBp: number) => {
    if (!data) return 0;
    return Number(Object.values(data.table("TotemLvConfig")).find((row) => Number(row._iAttributeEnhance) === enhanceBp)?._iLv ?? 0);
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

  const getTalentConfiguration = useCallback((career: number, level: number, prof: number, talents: Record<string, any> ): { available: boolean; branches: Array<{ id: string; options: NativeTalentChoice[] }>; walk: Record<string, any> | null; effects: { attrs: Array<[number, number]>; buffs: number[] } } => {
    if (!data) return { available: false, branches: [], walk: null, effects: { attrs: [], buffs: [] } };
    const digest = data.row("TalentDigest", 1);
    const branches: Array<{ id: string; options: NativeTalentChoice[] }> = digest?.branches && typeof digest.branches === "object"
      ? Object.keys(digest.branches as Record<string, unknown>).map((id) => ({
          id,
          options: talentOptions(id, career, prof, data) as NativeTalentChoice[],
        })).filter((branch) => branch.options.length > 0)
      : [];
    const build = { career, level, talents };
    return { available: !!digest, branches, walk: talentWalk(build, data), effects: talentEffects(build, data) as { attrs: Array<[number, number]>; buffs: number[] } };
  }, [data]);

  const deriveLearnedSkillEffectsForBuild = useCallback((levels: Record<string, number>, ridden = false) => {
    if (!data) return { passiveSkillIds: [] as number[], autoBuffIds: [] as number[] };
    return deriveLearnedSkillEffects(skillTreeOptions, levels, data.table("BuffConfig"), ridden);
  }, [data, skillTreeOptions]);

  const simulateDistribution = useCallback((
    attacker: CombatBuild,
    defender: CombatDefender,
    rotationSkillIds: number[],
    durationMs = 30000,
    options: CombatDistributionOptions = { runs: 3000, seed: 20260101, bins: 72, captureRun: true },
  ) => {
    if (!data) throw new Error("Combat engine is not ready yet.");
    return simulateCombatDistribution(attacker, defender, rotationSkillIds, durationMs, options, data);
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

  return { status, error, ready: status === "ready", careerOptions, namedOptions, configureCareer, skillOptions, skillTreeOptions, deriveLearnedSkillEffectsForBuild, equipmentCatalog, attributeOptions, petOptions, getCharacterSheet, getGearCustomization, getGearLevelCaps, getCardCustomization, getTotemEnhanceBp, getTotemLevelForEnhanceBp, getTalentConfiguration, simulate, simulateDistribution };
}
