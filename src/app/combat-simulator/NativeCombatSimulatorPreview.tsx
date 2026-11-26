"use client";

import { useEffect, useMemo, useState } from "react";
import { useCombatSimulatorEngine } from "@/lib/ro3-combat-simulator/hooks/use-combat-simulator-engine";
import type { CombatBuild, CombatDefender, CombatDistributionResult } from "@/lib/ro3-combat-simulator/types";
import { validateCombatInput } from "@/lib/ro3-combat-simulator/validate-input.mjs";
import { emptyNativeEquipmentSelection, moveUniqueCardSelection, toEngineEquipment, type NativeEquipmentSelection } from "@/lib/ro3-combat-simulator/build-input";
import { EQUIPMENT_GRIDS, CARD_SOCKETS } from "@/lib/ro3-combat-simulator/equipment-options";
import { NATIVE_BUILD_STORAGE_KEY, parseNativeSavedBuilds, removeNativeSavedBuild, serializeNativeSavedBuilds, upsertNativeSavedBuild, type NativeBuildDraft, type NativeSavedBuild } from "@/lib/ro3-combat-simulator/native-build-storage";
import { CLASS_PROFILES } from "@/lib/ro3-combat-simulator/engine/ro3-damage-engine.mjs";
import { importLegacyRoyalGuardBuild, parseLegacyBuildBook } from "@/lib/ro3-combat-simulator/legacy-build-import";

type Member = {
  id: string; characterName: string | null; discordUsername: string | null; job: string | null;
  hp: number | null; patk: number | null; matk: number | null; pdef: number | null; mdef: number | null; ro3Stats: unknown;
};
const label = (m: Member) => m.characterName || m.discordUsername || "Unnamed member";
const levelOf = (v: unknown) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const n = (v as Record<string, unknown>).level;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
};
const numeric = (value: string, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const inputClass = "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";
const statNames = ["STR", "AGI", "VIT", "INT", "DEX", "LUK"];
function analyzeCombatDistribution(result: CombatDistributionResult) {
  const sorted = Array.from(result.totals).sort((a, b) => a - b);
  const n = sorted.length;
  const mean = n ? sorted.reduce((sum, value) => sum + value, 0) / n : 0;
  const variance = n ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n : 0;
  const quantile = (p: number) => {
    if (!n) return 0;
    const at = p * (n - 1), lo = Math.floor(at), hi = Math.min(n - 1, lo + 1);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
  };
  const skills = result.skills.map((skill) => {
    const landed = skill.hits + skill.crits;
    const attempts = landed + skill.misses;
    return { ...skill, landed, attempts, hitPct: attempts ? landed / attempts : 1, critPct: landed ? skill.crits / landed : 0, share: mean ? skill.total / mean : 0 };
  }).sort((a, b) => b.total - a.total);
  const landed = skills.reduce((sum, skill) => sum + skill.landed, 0);
  const crits = skills.reduce((sum, skill) => sum + skill.crits, 0);
  const histogram = Array.from({ length: 36 }, () => 0);
  const min = sorted[0] ?? 0, max = sorted[n - 1] ?? 0, span = Math.max(1, max - min);
  for (const value of sorted) histogram[Math.min(35, Math.floor(((value - min) / span) * 36))]++;
  const timeBuckets = Array.from({ length: result.nBuckets }, (_, index) => {
    const bucketDamage = skills.reduce((sum, skill) => sum + (skill.perBucket[index] ?? 0), 0);
    const bucketMs = Math.min(result.bucketMs, Math.max(0, result.durationMs - index * result.bucketMs));
    return { startMs: index * result.bucketMs, dps: bucketMs > 0 ? bucketDamage / (bucketMs / 1000) : 0 };
  });
  return { mean, sd: Math.sqrt(variance), p5: quantile(0.05), p50: quantile(0.5), p95: quantile(0.95), skills, critPct: landed ? crits / landed : 0, histogram, min, max, timeBuckets };
}
const parseAttributePairs = (value: string): Array<[number, number]> => value.split(/[ ,]+/)
  .map((entry) => entry.split(":"))
  .filter((parts) => parts.length === 2)
  .map(([id, amount]) => [Number(id), Number(amount)] as [number, number])
  .filter(([id, amount]) => Number.isInteger(id) && id > 0 && Number.isFinite(amount));
const parseTotemLoadout = (value: string, enhanceBp: number): Array<{guid:number;id:number;attrs:Array<[number,number]>;skills:number[];enhanceBp:number}> => {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0,3).flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const attrs = Array.isArray(item.attrs) ? item.attrs.flatMap((pair) =>
        Array.isArray(pair) && pair.length >= 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))
          ? [[Number(pair[0]), Number(pair[1])] as [number,number]] : []) : [];
      const skills = Array.isArray(item.skills) ? item.skills.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
      return [{ guid: Number(item.guid) || index + 1, id: Number(item.id) || 0, attrs, skills, enhanceBp }];
    });
  } catch { return []; }
};
const parseIdList = (value: string): number[] => value.split(/[ ,]+/).map(Number).filter((id) => Number.isInteger(id) && id > 0);
const parseTalentSkillLevels = (value: string): Record<string, number> => Object.fromEntries(
  value.split(/[ ,]+/).map((entry) => entry.split(":")).filter((parts) => parts.length === 2)
    .map(([group, level]) => [String(Number(group)), Number(level)])
    .filter(([group, level]) => Number(group) > 0 && Number.isInteger(Number(level)) && Number(level) >= 0),
);

function ProfileCard({ title, kind, value, onChange, members }: {
  title: string; kind: "attacker" | "defender"; value: string; onChange: (v: string) => void; members: Member[];
}) {
  const selected = members.find((m) => m.id === value) ?? null;
  const stats = kind === "attacker"
    ? [["HP", selected?.hp], ["P.ATK", selected?.patk], ["M.ATK", selected?.matk], ["P.DEF", selected?.pdef], ["M.DEF", selected?.mdef], ["Level", levelOf(selected?.ro3Stats)]]
    : [["P.DEF", selected?.pdef], ["M.DEF", selected?.mdef]];
  return <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
    <h2 className="text-sm font-semibold text-white">{title}</h2>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">Manual / default values</option>
      {members.map((m) => <option key={m.id} value={m.id}>{label(m)}{m.job ? ` · ${m.job}` : ""}</option>)}
    </select>
    {selected && <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{stats.map(([k,v]) => <div key={String(k)} className="rounded-lg bg-black/20 px-3 py-2"><dt className="text-[10px] uppercase text-zinc-500">{k}</dt><dd className="text-sm font-semibold text-zinc-100">{v == null ? "—" : Number(v).toLocaleString()}</dd></div>)}</dl>}
    <p className="mt-2 text-xs text-zinc-500">Profile preview only. Values are not silently converted into simulator equipment or attributes.</p>
  </section>;
}

export default function NativeCombatSimulatorPreview() {
  const engine = useCombatSimulatorEngine();
  const [members, setMembers] = useState<Member[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [attackerId, setAttackerId] = useState("");
  const [defenderId, setDefenderId] = useState("");
  const [level, setLevel] = useState("100");
  const [bonusStatPoints, setBonusStatPoints] = useState("0");
  const [stats, setStats] = useState(["80","60","50","20","80","20"]);
  const [equipment, setEquipment] = useState<NativeEquipmentSelection>(() => emptyNativeEquipmentSelection());
  const [pets, setPets] = useState<Array<{ id: number; lv: number; star: number; stage: number } | null>>([null, null, null, null]);
  const [assistPets, setAssistPets] = useState<Array<{ g: number; lv: number; star: number; stage: number } | null>>([null, null, null]);
  const [enchantAttrs, setEnchantAttrs] = useState<Array<[number, number]>>([]);
  const [extraAttrInput, setExtraAttrInput] = useState("");
  const [petCollectionAttrInput, setPetCollectionAttrInput] = useState("");
  const [attackerElement, setAttackerElement] = useState("1");
  const [bondBonusBp, setBondBonusBp] = useState("0");
  const [emblemAttrInput, setEmblemAttrInput] = useState("");
  const [totemSkillIds, setTotemSkillIds] = useState("");
  const [totemAttrInput, setTotemAttrInput] = useState("");
  const [totemEnhanceBp, setTotemEnhanceBp] = useState("0");
  const [totemLoadoutInput, setTotemLoadoutInput] = useState("");
  const [totemLevel, setTotemLevel] = useState("0");
  const [resonanceRefine, setResonanceRefine] = useState("0");
  const [resonanceEnhance, setResonanceEnhance] = useState("0");
  const [talentLevel, setTalentLevel] = useState("0");
  const [talentProf, setTalentProf] = useState("0");
  const [talentPicks, setTalentPicks] = useState<Record<string, [number, number]>>({});
  const [passiveSkillIds, setPassiveSkillIds] = useState("");
  const [talentSkillLevels, setTalentSkillLevels] = useState("");
  const [activeBuffIds, setActiveBuffIds] = useState("");
  const [skillLevels, setSkillLevels] = useState("");
  const [rotationCycle, setRotationCycle] = useState(false);
  const [cancelBackswing, setCancelBackswing] = useState(false);
  const [periodicOff, setPeriodicOff] = useState(false);
  const [periodicStartSeconds, setPeriodicStartSeconds] = useState("0");
  const [ridden, setRidden] = useState(false);
  const [def, setDef] = useState("5000");
  const [mdef, setMdef] = useState("3000");
  const [targetLevel, setTargetLevel] = useState("100");
  const [element, setElement] = useState("1");
  const [race, setRace] = useState("1");
  const [size, setSize] = useState("2");
  const [skillIds, setSkillIds] = useState("");
  const [rotationPreset, setRotationPreset] = useState("");
  const [disabledRotationIds, setDisabledRotationIds] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [duration, setDuration] = useState("30000");
  const [simulationRuns, setSimulationRuns] = useState("3000");
  const [simulationSeed, setSimulationSeed] = useState("20260101");
  const [result, setResult] = useState<CombatDistributionResult | null>(null);
  const [baselineResult, setBaselineResult] = useState<CombatDistributionResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [savedBuilds, setSavedBuilds] = useState<NativeSavedBuild[]>([]);
  const [savedBuildsReady, setSavedBuildsReady] = useState(false);
  const [savedBuildName, setSavedBuildName] = useState("Royal Guard Build");
  const [selectedSavedBuildId, setSelectedSavedBuildId] = useState("");
  const [savedBuildMessage, setSavedBuildMessage] = useState("");

  useEffect(() => {
    try {
      setSavedBuilds(parseNativeSavedBuilds(window.localStorage.getItem(NATIVE_BUILD_STORAGE_KEY)));
    } catch {
      setSavedBuildMessage("Saved builds are unavailable in this browser session.");
    } finally {
      setSavedBuildsReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/combat-simulator/members").then(async (r) => {
      if (!r.ok) throw new Error("Unable to load guild member profiles.");
      return r.json() as Promise<{members: Member[]}>;
    }).then((v) => { if (active) setMembers(v.members); })
      .catch((e: unknown) => { if (active) setProfilesError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setProfilesLoading(false); });
    return () => { active = false; };
  }, []);

  const talentConfiguration = useMemo(() => engine.getTalentConfiguration(1410, numeric(level,100), numeric(talentProf,0), {
    lv: numeric(talentLevel,0), prof: numeric(talentProf,0), picks: talentPicks, skills: parseTalentSkillLevels(talentSkillLevels),
  }), [engine.getTalentConfiguration, level, talentProf, talentLevel, talentPicks, talentSkillLevels]);
  const learnedSkillLevels = useMemo(() => parseTalentSkillLevels(skillLevels), [skillLevels]);
  const rotationEntries = useMemo(() => skillIds.trim() ? skillIds.trim().split(/[\s,;]+/).map(Number).filter((id)=>Number.isSafeInteger(id)&&id>0) : [], [skillIds]);
  const disabledRotationSet = useMemo(() => new Set(parseIdList(disabledRotationIds)), [disabledRotationIds]);

  const learnedSkillEffects = useMemo(() => engine.deriveLearnedSkillEffectsForBuild(learnedSkillLevels, ridden), [engine.deriveLearnedSkillEffectsForBuild, learnedSkillLevels, ridden]);
  const effectivePassiveSkills = useMemo(() => [...new Set([...passiveSkillIds.split(/[ ,]+/).map(Number).filter((id)=>Number.isInteger(id)&&id>0), ...learnedSkillEffects.passiveSkillIds])], [passiveSkillIds, learnedSkillEffects]);
  const effectiveBuffIds = useMemo(() => [...new Set([...parseIdList(activeBuffIds), ...learnedSkillEffects.autoBuffIds, ...talentConfiguration.effects.buffs])], [activeBuffIds, learnedSkillEffects, talentConfiguration.effects.buffs]);
  const setLearnedSkillLevel = (groupId: number, value: number) => {
    const next = { ...learnedSkillLevels };
    if (value > 0) next[String(groupId)] = value; else delete next[String(groupId)];
    setSkillLevels(Object.entries(next).map(([id, level])=>`${id}:${level}`).join(", "));
  };

  const nativeTotems = useMemo(() => {
    const imported = parseTotemLoadout(totemLoadoutInput, engine.getTotemEnhanceBp(numeric(totemLevel,0)));
    return imported.length ? imported : [{ guid: 1, id: 0, skills: parseIdList(totemSkillIds), attrs: parseAttributePairs(totemAttrInput), enhanceBp: numeric(totemEnhanceBp,0) }];
  }, [totemLoadoutInput, totemLevel, engine.getTotemEnhanceBp, totemSkillIds, totemAttrInput, totemEnhanceBp]);

  const attacker = useMemo<CombatBuild>(() => ({
    career: 1410, level: numeric(level,100), bonusStatPoints: numeric(bonusStatPoints,0), element: numeric(attackerElement,1), bondBonusBp: numeric(bondBonusBp,0), stats: stats.map((v) => numeric(v,1)) as CombatBuild["stats"],
    enchantAttrs, equipmentAttrs: parseAttributePairs(extraAttrInput), extraAttrs: parseAttributePairs(petCollectionAttrInput), emblemAttrs: parseAttributePairs(emblemAttrInput), totems: nativeTotems, resonance: { refine: numeric(resonanceRefine,0), enhance: numeric(resonanceEnhance,0) }, pets, assistPets,
    talents: { lv: numeric(talentLevel,0), prof: numeric(talentProf,0), picks: talentPicks, skills: parseTalentSkillLevels(talentSkillLevels) },
    passiveSkills: effectivePassiveSkills,
    activeBuffs: effectiveBuffIds, skillLevels: learnedSkillLevels, rotationCycle, cancelBackswing, periodicOff, periodicStartMs: numeric(periodicStartSeconds,0)*1000, ridden,
  }), [level, bonusStatPoints, stats, enchantAttrs, extraAttrInput, petCollectionAttrInput, attackerElement, bondBonusBp, emblemAttrInput, nativeTotems, resonanceRefine, resonanceEnhance, pets, assistPets, talentLevel, talentProf, talentPicks, passiveSkillIds, talentSkillLevels, activeBuffIds, skillLevels, rotationCycle, cancelBackswing, periodicOff, periodicStartSeconds, ridden, effectivePassiveSkills, effectiveBuffIds, learnedSkillLevels]);
  const engineEquipment = useMemo(() => engine.equipmentCatalog ? toEngineEquipment(equipment, engine.equipmentCatalog.equipment, engine.equipmentCatalog.cards, numeric(level,100), engine.getGearLevelCaps(numeric(level,100))) : { gear: [], cards: [] }, [equipment, engine.equipmentCatalog, engine.getGearLevelCaps, level]);
  const characterSheet = useMemo(() => {
    if (!engine.ready) return null;
    try { return engine.getCharacterSheet(attacker, equipment); } catch { return null; }
  }, [engine.ready, engine.getCharacterSheet, attacker, equipment]);
  const defender = useMemo<CombatDefender>(() => ({
    name: "Training target", level: numeric(targetLevel,100), def: numeric(def,0), mdef: numeric(mdef,0),
    element: numeric(element,1), race: numeric(race,1), size: numeric(size,2),
  }), [targetLevel,def,mdef,element,race,size]);

  function captureNativeBuildDraft(): NativeBuildDraft {
    return {
      level, bonusStatPoints, stats: [...stats], equipment: JSON.parse(JSON.stringify(equipment)),
      pets: JSON.parse(JSON.stringify(pets)), assistPets: JSON.parse(JSON.stringify(assistPets)),
      enchantAttrs: JSON.parse(JSON.stringify(enchantAttrs)), extraAttrInput, petCollectionAttrInput, attackerElement, bondBonusBp, simulationRuns, simulationSeed, emblemAttrInput, totemSkillIds, totemAttrInput,
      totemEnhanceBp, totemLoadoutInput, totemLevel, resonanceRefine, resonanceEnhance, talentLevel, talentProf,
      talentPicks: JSON.parse(JSON.stringify(talentPicks)), passiveSkillIds, talentSkillLevels,
      activeBuffIds, skillLevels, rotationCycle, cancelBackswing, periodicOff, periodicStartSeconds, ridden,
      def, mdef, targetLevel, element, race, size, skillIds, disabledRotationIds, duration,
    };
  }

  function persistNativeBuilds(next: NativeSavedBuild[]) {
    try {
      window.localStorage.setItem(NATIVE_BUILD_STORAGE_KEY, serializeNativeSavedBuilds(next));
      setSavedBuilds(next);
      return true;
    } catch {
      setSavedBuildMessage("Unable to save builds. Browser storage may be full or disabled.");
      return false;
    }
  }

  function saveNativeBuild() {
    if (!savedBuildsReady) return;
    const name = savedBuildName.trim().slice(0, 40) || "Royal Guard Build";
    const build: NativeSavedBuild = {
      id: `${Date.now()}-${savedBuilds.length}`,
      name,
      updatedAt: new Date().toISOString(),
      state: captureNativeBuildDraft(),
    };
    if (persistNativeBuilds(upsertNativeSavedBuild(savedBuilds, build))) {
      setSelectedSavedBuildId(build.id);
      setSavedBuildName(name);
      setSavedBuildMessage("Build saved in this browser.");
    }
  }

  function loadNativeBuild() {
    const build = savedBuilds.find((item) => item.id === selectedSavedBuildId);
    if (!build) return;
    const state = build.state;
    setLevel(state.level); setBonusStatPoints(state.bonusStatPoints ?? "0"); setStats([...state.stats]); setEquipment(JSON.parse(JSON.stringify(state.equipment)));
    setPets(JSON.parse(JSON.stringify(state.pets))); setAssistPets(JSON.parse(JSON.stringify(state.assistPets)));
    setEnchantAttrs(JSON.parse(JSON.stringify(state.enchantAttrs))); setExtraAttrInput(state.extraAttrInput); setPetCollectionAttrInput(state.petCollectionAttrInput ?? ""); setAttackerElement(state.attackerElement ?? "1"); setBondBonusBp(state.bondBonusBp ?? "0"); setSimulationRuns(state.simulationRuns ?? "3000"); setSimulationSeed(state.simulationSeed ?? "20260101"); setEmblemAttrInput(state.emblemAttrInput);
    setTotemSkillIds(state.totemSkillIds); setTotemAttrInput(state.totemAttrInput); setTotemEnhanceBp(state.totemEnhanceBp);
    setTotemLoadoutInput(state.totemLoadoutInput ?? ""); setTotemLevel(state.totemLevel ?? "0");
    setResonanceRefine(state.resonanceRefine); setResonanceEnhance(state.resonanceEnhance);
    setTalentLevel(state.talentLevel); setTalentProf(state.talentProf); setTalentPicks(JSON.parse(JSON.stringify(state.talentPicks)));
    setPassiveSkillIds(state.passiveSkillIds); setTalentSkillLevels(state.talentSkillLevels);
    setActiveBuffIds(state.activeBuffIds); setSkillLevels(state.skillLevels); setRotationCycle(state.rotationCycle);
    setCancelBackswing(state.cancelBackswing); setPeriodicOff(state.periodicOff); setPeriodicStartSeconds(state.periodicStartSeconds); setRidden(state.ridden);
    setDef(state.def); setMdef(state.mdef); setTargetLevel(state.targetLevel); setElement(state.element);
    setRace(state.race); setSize(state.size); setSkillIds(state.skillIds); setDisabledRotationIds(state.disabledRotationIds); setDuration(state.duration);
    setSavedBuildName(build.name); setResult(null); setSimulationError(null); setSelectedSkillId("");
    setSavedBuildMessage(`Loaded "${build.name}".`);
  }

  function importLegacyBuilds() {
    if (!savedBuildsReady || !engine.ready) return;
    let raw: string | null = null;
    let singleRaw: string | null = null;
    try {
      raw = window.localStorage.getItem("ro3sim.builds.v1");
      singleRaw = window.localStorage.getItem("ro3sim.v1");
    } catch { setSavedBuildMessage("Cannot access legacy simulator storage in this browser context."); return; }
    const tabs = parseLegacyBuildBook(raw);
    if (!tabs.length && singleRaw) {
      try {
        const state: unknown = JSON.parse(singleRaw);
        if (state && typeof state === "object" && !Array.isArray(state)) {
          tabs.push({ id: 1, name: "Legacy saved build", state });
        }
      } catch { /* malformed single-build storage is ignored */ }
    }
    if (!tabs.length) {
      setSavedBuildMessage("No legacy saved tabs found. Open and save your builds in the legacy simulator first.");
      return;
    }
    const imported: NativeSavedBuild[] = [];
    const warnings: string[] = [];
    const unsupported: string[] = [];
    for (const tab of tabs) {
      const mapped = importLegacyRoyalGuardBuild(tab.state, captureNativeBuildDraft(), engine.skillOptions, engine.getTotemLevelForEnhanceBp);
      warnings.push(...mapped.warnings);
      unsupported.push(...mapped.unsupported);
      if (!mapped.draft) continue;
      imported.push({
        id: `legacy-${tab.id}-${Date.now()}-${imported.length}`,
        name: `Legacy · ${tab.name}`.slice(0,40),
        updatedAt: new Date().toISOString(),
        state: mapped.draft,
      });
    }
    if (!imported.length) {
      setSavedBuildMessage(`Found ${tabs.length} legacy tab(s), but none were importable. ${[...new Set(unsupported)].slice(0,2).join(" ")}`);
      return;
    }
    let next = savedBuilds;
    for (const build of imported) next = upsertNativeSavedBuild(next, build);
    if (persistNativeBuilds(next)) {
      setSelectedSavedBuildId(imported[0].id);
      setSavedBuildName(imported[0].name);
      const notes = [...new Set([...warnings, ...unsupported])];
      setSavedBuildMessage(`Imported ${imported.length} Royal Guard tab(s). ${notes.length ? `Review limitations: ${notes.slice(0,2).join(" ")}` : "No unsupported fields detected."}`);
    }
  }

  function deleteNativeBuild() {
    if (!selectedSavedBuildId) return;
    const next = removeNativeSavedBuild(savedBuilds, selectedSavedBuildId);
    if (persistNativeBuilds(next)) {
      setSelectedSavedBuildId(next[0]?.id ?? "");
      setSavedBuildMessage("Saved build deleted.");
    }
  }

  function applyRotationPreset(index: number) {
    const preset = CLASS_PROFILES.royalguard.candidateRotations[index];
    if (!preset) return;
    const ids = preset.skills.map((sourceId: number) => {
      const groupId = Math.floor(sourceId / 100);
      return engine.skillOptions.find((option) => option.groupId === groupId)?.id ?? sourceId;
    });
    setSkillIds(ids.join(", "));
    setDisabledRotationIds("");
    setRotationPreset(String(index));
    setResult(null);
    setSimulationError(null);
  }

  function moveRotationEntry(index: number, offset: number) {
    const next = [...rotationEntries];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSkillIds(next.join(", "));
  }

  function removeRotationEntry(index: number) {
    setSkillIds(rotationEntries.filter((_, i) => i !== index).join(", "));
  }

  function setRotationEntryDisabled(id: number, disabled: boolean) {
    const next = new Set(disabledRotationSet);
    if (disabled) next.add(id); else next.delete(id);
    setDisabledRotationIds([...next].join(", "));
  }

  function runSimulation() {
    setSimulationError(null); setResult(null);
    try {
      const validated = validateCombatInput({
        level, stats, defenderLevel: targetLevel, pdef: def, mdef,
        element, race, size, durationMs: duration, skillIds,
      });
      const validatedAttacker: CombatBuild = {
        career: 1410, level: validated.level, element: numeric(attackerElement,1), bondBonusBp: numeric(bondBonusBp,0), stats: validated.stats,
        enchantAttrs, equipmentAttrs: parseAttributePairs(extraAttrInput), extraAttrs: parseAttributePairs(petCollectionAttrInput), emblemAttrs: parseAttributePairs(emblemAttrInput), totems: nativeTotems, resonance: { refine: numeric(resonanceRefine,0), enhance: numeric(resonanceEnhance,0) }, pets, assistPets,
        talents: { lv: numeric(talentLevel,0), prof: numeric(talentProf,0), picks: talentPicks, skills: parseTalentSkillLevels(talentSkillLevels) },
        passiveSkills: effectivePassiveSkills,
        activeBuffs: effectiveBuffIds, skillLevels: learnedSkillLevels, rotationCycle, cancelBackswing, periodicOff, periodicStartMs: numeric(periodicStartSeconds,0)*1000, ridden,
        ...engineEquipment,
      };
      const validatedDefender: CombatDefender = {
        name: "Training target", level: validated.defenderLevel,
        def: validated.pdef, mdef: validated.mdef, element: validated.element,
        race: validated.race, size: validated.size,
      };
      const output = engine.simulateDistribution(
        validatedAttacker, validatedDefender, validated.skillIds.filter((id) => !new Set(parseIdList(disabledRotationIds)).has(id)), validated.durationMs,
        { runs: Math.max(100, Math.min(10000, Math.round(numeric(simulationRuns,3000)))), seed: Math.max(0, Math.round(numeric(simulationSeed,20260101))), bins: 72, bucketMs: Math.max(1000, Math.ceil((validated.durationMs / 1000) / 60) * 1000), captureRun: true },
      );
      setResult(output); setRunCount((n) => n + 1);
    } catch (e) { setSimulationError(e instanceof Error ? e.message : String(e)); }
  }

  const distributionSummary = result ? analyzeCombatDistribution(result) : null;
  const baselineSummary = baselineResult ? analyzeCombatDistribution(baselineResult) : null;

  return <div className="space-y-5">
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[180px] flex-1 text-xs text-zinc-400">Build name
          <input value={savedBuildName} maxLength={40} onChange={(e)=>setSavedBuildName(e.target.value)} className={inputClass} placeholder="Royal Guard Build"/>
        </label>
        <label className="min-w-[180px] flex-1 text-xs text-zinc-400">Saved builds
          <select value={selectedSavedBuildId} onChange={(e)=>setSelectedSavedBuildId(e.target.value)} className={inputClass}>
            <option value="">Select a saved build</option>
            {savedBuilds.map((build)=><option key={build.id} value={build.id}>{build.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!savedBuildsReady} onClick={saveNativeBuild} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40">Save build</button>
        <button type="button" disabled={!savedBuildsReady || !engine.ready} onClick={importLegacyBuilds} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 disabled:opacity-40">Import legacy tabs</button>
        <button type="button" disabled={!selectedSavedBuildId} onClick={loadNativeBuild} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 disabled:opacity-40">Load</button>
        <button type="button" disabled={!selectedSavedBuildId} onClick={deleteNativeBuild} className="rounded-lg border border-rose-400/30 px-4 py-2.5 text-sm font-medium text-rose-200 disabled:opacity-40">Delete</button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Up to 8 native builds, stored locally in this browser. Guild profile selections and simulation results are not saved.</p>
      {savedBuildMessage && <p aria-live="polite" className="mt-2 text-xs text-zinc-300">{savedBuildMessage}</p>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Native engine</p><p className="mt-1 text-sm text-zinc-200">{engine.ready ? "Full exported game data loaded" : engine.status === "error" ? "Engine initialisation failed" : "Loading exported game data…"}</p>{engine.error && <p className="mt-1 text-xs text-rose-300">{engine.error}</p>}</div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${engine.ready ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{engine.status}</span>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <ProfileCard title="Attacker guild profile" kind="attacker" value={attackerId} onChange={setAttackerId} members={members}/>
      <ProfileCard title="Defender guild profile" kind="defender" value={defenderId} onChange={setDefenderId} members={members}/>
    </div>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Attacker build · Royal Guard</h2><p className="mt-1 text-xs text-zinc-500">Uses the simulator's existing Royal Guard career record (1410). No separate DPS career is introduced.</p></div><span className="text-xs text-zinc-500">Native build inputs</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-zinc-400">Career<select disabled value="1410" className={inputClass}><option value="1410">Royal Guard</option></select></label>
        <label className="text-xs text-zinc-400">Character level<input type="number" min="1" max="200" value={level} onChange={(e)=>setLevel(e.target.value)} className={inputClass}/></label>
        {statNames.map((name,i)=><label key={name} className="text-xs text-zinc-400">{name}<input type="number" min="1" max="99" value={stats[i]} onChange={(e)=>setStats((old)=>old.map((v,j)=>j===i?e.target.value:v))} className={inputClass}/></label>)}
      </div>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Season talents &amp; passive skills</h2>
      <p className="mt-1 text-xs text-zinc-500">Talent allocation, prerequisite skill levels and class choices use the generated TalentDigest and existing talentWalk/talentEffects functions when that digest is available. Passive skill IDs are forwarded to the engine's existing passive attribute pipeline.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-zinc-400">Total talent level<input type="number" min="0" max="999" value={talentLevel} onChange={(e)=>setTalentLevel(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Profession ID<input type="number" min="0" value={talentProf} onChange={(e)=>setTalentProf(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Passive SkillConfig IDs<input value={passiveSkillIds} onChange={(e)=>setPassiveSkillIds(e.target.value)} placeholder="Comma-separated IDs" className={inputClass}/></label>
        <label className="text-xs text-zinc-400 sm:col-span-3">Talent prerequisite skill levels<input value={talentSkillLevels} onChange={(e)=>setTalentSkillLevels(e.target.value)} placeholder="Skill group ID:level, e.g. 120:5, 121:3" className={inputClass}/></label>
      </div>
      {talentConfiguration.branches.length>0 ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {talentConfiguration.branches.map((branch)=>{const current=talentPicks[branch.id]??[0,0];const cluster=branch.options.find((option)=>option.id===current[0])??branch.options[0];return <div key={branch.id} className="rounded-lg bg-black/20 p-3">
          <p className="text-xs font-medium text-zinc-300">Talent branch {branch.id}</p>
          <select value={cluster?.id??0} onChange={(e)=>{const option=branch.options.find((item)=>item.id===Number(e.target.value));setTalentPicks((old)=>({...old,[branch.id]:[Number(e.target.value),option?.kids?.[0]?.id??0]}));}} className={inputClass}>
            {branch.options.map((option)=><option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
          <select value={current[1]||cluster?.kids?.[0]?.id||0} onChange={(e)=>setTalentPicks((old)=>({...old,[branch.id]:[cluster?.id??0,Number(e.target.value)]}))} className={inputClass}>
            {(cluster?.kids??[]).map((option)=><option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </div>;})}
      </div> : <p className="mt-3 text-xs text-zinc-500">{talentConfiguration.available ? "No talent branches are available for this career/profession selection." : "Season talent options are not present in the current exported dataset. Talent inputs will not affect the result until the TalentDigest is generated and included."}</p>}
      {talentConfiguration.walk&&<p className="mt-3 text-xs text-zinc-400">Allocated talent levels: {talentConfiguration.walk.total} · Unspent: {talentConfiguration.walk.spare} · Active branch choices: {talentConfiguration.walk.reached.length}</p>}
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Emblems &amp; totem modifiers</h2>
      <p className="mt-1 text-xs text-zinc-500">The legacy engine supports emblem attributes and deployed totem effects. Until their source catalogs are fully exposed in the native editor, enter the exact attribute IDs and values from your build. Totem skill IDs use TotemSkillConfig.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">Emblem attributes (ID:value)<input value={emblemAttrInput} onChange={(e)=>setEmblemAttrInput(e.target.value)} placeholder="103:120, 104:120" className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Totem skill IDs<input value={totemSkillIds} onChange={(e)=>setTotemSkillIds(e.target.value)} placeholder="Comma-separated TotemSkillConfig IDs" className={inputClass}/></label>
        <label className="block text-xs text-zinc-400 sm:col-span-2">Imported totem loadout (JSON)
          <textarea value={totemLoadoutInput} onChange={(e)=>setTotemLoadoutInput(e.target.value)} rows={3} placeholder="Legacy totem selections are imported here." className={inputClass}/>
        </label>
        <label className="text-xs text-zinc-400">Legacy totem system level<input type="number" min="0" value={totemLevel} onChange={(e)=>setTotemLevel(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Totem attributes (ID:value)<input value={totemAttrInput} onChange={(e)=>setTotemAttrInput(e.target.value)} placeholder="103:50, 104:50" className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Totem enhancement (basis points)<input type="number" min="0" value={totemEnhanceBp} onChange={(e)=>setTotemEnhanceBp(e.target.value)} className={inputClass}/></label>
      </div>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Pets &amp; support pets</h2>
      <p className="mt-1 text-xs text-zinc-500">Uses the simulator's PetDigest, PetGrowth and PetRules data. The first deployed pet is the primary combat pet; the remaining deployed slots supply supported passives. Support pets contribute shared attributes.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {pets.map((pet,index)=><div key={index} className="rounded-lg bg-black/20 p-3">
          <p className="text-xs font-medium text-zinc-300">Deployed pet {index+1}{index===0?" · Primary":""}</p>
          <select value={pet?.id??0} onChange={(e)=>{const option=engine.petOptions.find((item)=>item.id===Number(e.target.value));setPets((old)=>old.map((slot,i)=>i===index?(option?{id:option.id,lv:slot?.lv??1,star:slot?.star??1,stage:slot?.stage??0}:null):slot));}} className={inputClass}>
            <option value="0">Empty</option>{engine.petOptions.map((option)=><option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
          {pet&&<div className="mt-2 grid grid-cols-3 gap-2">
            <label className="text-[10px] text-zinc-500">Level<input type="number" min="1" max={engine.petOptions.find((item)=>item.id===pet.id)?.maxLevel??100} value={pet.lv} onChange={(e)=>setPets((old)=>old.map((slot,i)=>i===index&&slot?{...slot,lv:numeric(e.target.value,1)}:slot))} className={inputClass}/></label>
            <label className="text-[10px] text-zinc-500">Star<select value={pet.star} onChange={(e)=>setPets((old)=>old.map((slot,i)=>i===index&&slot?{...slot,star:Number(e.target.value)}:slot))} className={inputClass}>{[1,2,3,4,5,6].map((n)=><option key={n} value={n}>{n}</option>)}</select></label>
            <label className="text-[10px] text-zinc-500">Stage<select value={pet.stage} disabled={pet.star===6} onChange={(e)=>setPets((old)=>old.map((slot,i)=>i===index&&slot?{...slot,stage:Number(e.target.value)}:slot))} className={inputClass}>{[0,1,2,3].map((n)=><option key={n} value={n}>{n}</option>)}</select></label>
          </div>}
        </div>)}
      </div>
      <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Support pets (3)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {assistPets.map((pet,index)=><div key={index} className="rounded-lg bg-black/20 p-3">
            <p className="text-xs font-medium text-zinc-300">Support slot {index+1}</p>
            <select value={pet?.g??0} onChange={(e)=>{const option=engine.petOptions.find((item)=>item.growthId===Number(e.target.value));setAssistPets((old)=>old.map((slot,i)=>i===index?(option?{g:option.growthId,lv:slot?.lv??1,star:slot?.star??1,stage:slot?.stage??0}:null):slot));}} className={inputClass}>
              <option value="0">Empty</option>{Array.from(new Map(engine.petOptions.map((option)=>[option.growthId,option])).values()).map((option)=><option key={option.growthId} value={option.growthId}>{option.growthName}</option>)}
            </select>
            {pet&&<div className="mt-2 grid grid-cols-3 gap-2">
              <label className="text-[10px] text-zinc-500">Level<input type="number" min="1" max={engine.petOptions.find((item)=>item.growthId===pet.g)?.maxLevel??100} value={pet.lv} onChange={(e)=>setAssistPets((old)=>old.map((slot,i)=>i===index&&slot?{...slot,lv:numeric(e.target.value,1)}:slot))} className={inputClass}/></label>
              <label className="text-[10px] text-zinc-500">Star<select value={pet.star} onChange={(e)=>setAssistPets((old)=>old.map((slot,i)=>i===index&&slot?{...slot,star:Number(e.target.value)}:slot))} className={inputClass}>{[1,2,3,4,5,6].map((n)=><option key={n} value={n}>{n}</option>)}</select></label>
              <label className="text-[10px] text-zinc-500">Stage<select value={pet.stage} disabled={pet.star===6} onChange={(e)=>setAssistPets((old)=>old.map((slot,i)=>i===index&&slot?{...slot,stage:Number(e.target.value)}:slot))} className={inputClass}>{[0,1,2,3].map((n)=><option key={n} value={n}>{n}</option>)}</select></label>
            </div>}
          </div>)}
        </div>
      </details>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Enchantments &amp; resonance</h2>
      <p className="mt-1 text-xs text-zinc-500">Enchantment attributes are passed directly to the legacy character-sheet calculation. Resonance uses the existing RefiningEffectTable and StrengthenEffectTable thresholds.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">Refine resonance level<input type="number" min="0" max="99" value={resonanceRefine} onChange={(e)=>setResonanceRefine(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Enhance resonance level<input type="number" min="0" max="999" value={resonanceEnhance} onChange={(e)=>setResonanceEnhance(e.target.value)} className={inputClass}/></label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-xs text-zinc-400">Attacker element ID<input type="number" min="1" value={attackerElement} onChange={(e)=>setAttackerElement(e.target.value)} className={inputClass}/></label>
        <label className="block text-xs text-zinc-400">Bond / boss bonus (BP)<input type="number" value={bondBonusBp} onChange={(e)=>setBondBonusBp(e.target.value)} className={inputClass}/></label>
      </div>
      <div className="mt-3 space-y-2">
        <label className="block text-xs text-zinc-400">Legacy ex bonuses (equipment attributes)
          <input value={extraAttrInput} onChange={(e)=>setExtraAttrInput(e.target.value)} placeholder="attributeId:value, e.g. 1:10, 1031:500" className={inputClass}/>
          <span className="mt-1 block text-[11px] text-zinc-500">Maps to the legacy simulator’s equipmentAttrs input, before attribute conversions.</span>
        </label>
        <label className="block text-xs text-zinc-400">Pet collection attributes
          <input value={petCollectionAttrInput} onChange={(e)=>setPetCollectionAttrInput(e.target.value)} placeholder="attributeId:value, e.g. 104:50" className={inputClass}/>
          <span className="mt-1 block text-[11px] text-zinc-500">Imported pet collection bonuses map to the engine extraAttrs input.</span>
        </label>
        <p className="text-xs font-medium text-zinc-300">Enchantment attributes</p>
        {enchantAttrs.map(([attribute, amount], index)=><div key={index} className="grid grid-cols-[1fr_110px_auto] gap-2">
          <select value={attribute} onChange={(e)=>setEnchantAttrs((old)=>old.map((entry,i)=>i===index?[Number(e.target.value),entry[1]]:entry))} className={inputClass}>
            {engine.attributeOptions.map((option)=><option key={option.id} value={option.id}>{option.name} · {option.id}</option>)}
          </select>
          <input type="number" value={amount} onChange={(e)=>setEnchantAttrs((old)=>old.map((entry,i)=>i===index?[entry[0],numeric(e.target.value,0)]:entry))} className={inputClass} aria-label="Enchantment amount"/>
          <button type="button" onClick={()=>setEnchantAttrs((old)=>old.filter((_,i)=>i!==index))} className="rounded-lg border border-white/10 px-3 text-xs text-zinc-300">Remove</button>
        </div>)}
        <button type="button" onClick={()=>setEnchantAttrs((old)=>[...old,[engine.attributeOptions[0]?.id??1,0]])} disabled={!engine.attributeOptions.length} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-40">Add enchant attribute</button>
      </div>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Equipment &amp; cards</h2>
      <p className="mt-1 text-xs text-zinc-500">Gear rolls, eligible affixes, fixed/random stunts, refine and enhance feed the existing engine. Two-handed weapons expose off-hand grid levels.</p>
      <details className="mt-3" open><summary className="cursor-pointer text-xs font-medium text-zinc-300">Equipment slots (7)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {EQUIPMENT_GRIDS.map((grid,index)=>{
            const choices=(engine.equipmentCatalog?.equipment ?? []).filter((item)=>grid.parts.includes(item.part)&&item.levelRequired<=numeric(level,100)&&!(index===1&&equipment.gear[0]?.id&&engine.equipmentCatalog?.equipment.find((w)=>w.id===equipment.gear[0]?.id)?.part===1));
            const selectedItem=choices.find((item)=>item.id===equipment.gear[index]?.id);
            const gearOptions=selectedItem ? engine.getGearCustomization(selectedItem.id,index+1) : null;
            return <div key={grid.index} className="rounded-lg bg-black/20 p-3"><label className="block text-xs text-zinc-400">{grid.name}
              <select disabled={index===1&&!!engine.equipmentCatalog?.equipment.find((w)=>w.id===equipment.gear[0]?.id&&w.part===1)} value={equipment.gear[index]?.id ?? 0} onChange={(e)=>{const id=Number(e.target.value);const picked=choices.find((item)=>item.id===id);setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===index?{...slot,id}:index===0&&picked?.part===1&&i===1?{...slot,id:0}:slot)}));}} className={inputClass}>
                <option value="0">Empty</option>{choices.map((item)=><option key={item.id} value={item.id}>{item.name} · T{item.tier} · Lv {item.levelRequired}</option>)}
              </select></label>
              {equipment.gear[index]?.id!==0&&<div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-zinc-500">Roll (0–10000)<input type="number" min="0" max="10000" value={equipment.gear[index]?.roll??5000} onChange={(e)=>setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===index?{...slot,roll:numeric(e.target.value,5000)}:slot)}))} className={inputClass}/></label>
                <label className="text-[11px] text-zinc-500">Refine<input type="number" min="0" max={engine.getGearLevelCaps(numeric(level,100)).refine[index]??0} value={equipment.gear[index]?.refine??0} onChange={(e)=>setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===index?{...slot,refine:numeric(e.target.value,0)}:slot)}))} className={inputClass}/></label>
                <label className="text-[11px] text-zinc-500">Enhance<input type="number" min="0" max={engine.getGearLevelCaps(numeric(level,100)).enhance[index]??0} value={equipment.gear[index]?.enhance??0} onChange={(e)=>setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===index?{...slot,enhance:numeric(e.target.value,0)}:slot)}))} className={inputClass}/></label>
              </div>}
              {selectedItem&&gearOptions&&<div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                {gearOptions.affixSlots>0&&<div><p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Random attributes · {gearOptions.affixSlots} available</p>
                  {Array.from({length:Math.min(gearOptions.affixSlots,2)},(_,slotIndex)=><select key={slotIndex} value={equipment.gear[index]?.affixes[slotIndex]??0} onChange={(e)=>setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===index?{...slot,affixes:slot.affixes.map((id,j)=>j===slotIndex?Number(e.target.value):id)}:slot)}))} className={inputClass}>
                    <option value="0">No attribute {slotIndex+1}</option>{gearOptions.affixes.map((affix)=><option key={affix.id} value={affix.id}>{affix.name} · {affix.min}–{affix.max}</option>)}
                  </select>)}
                </div>}
                {gearOptions.fixedStunts.length>0&&<div><p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Fixed stunts</p>{gearOptions.fixedStunts.map((stunt)=><p key={stunt.id} className="text-xs text-zinc-300">{stunt.name}</p>)}</div>}
                {gearOptions.stuntPools.map((pool,poolIndex)=><label key={poolIndex} className="block text-[10px] text-zinc-500">Stunt {poolIndex+1} · {pool.chance/100}% chance
                  <select value={equipment.gear[index]?.stunts[poolIndex]??0} onChange={(e)=>setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===index?{...slot,stunts:slot.stunts.map((id,j)=>j===poolIndex?Number(e.target.value):id)}:slot)}))} className={inputClass}>
                    <option value="0">No stunt</option>{pool.options.map((stunt)=><option key={stunt.id} value={stunt.id}>{stunt.name}</option>)}
                  </select>
                </label>)}
                {index===0&&selectedItem.part===1&&<div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
                  <label className="text-[10px] text-zinc-500">Off-hand Refine<input type="number" min="0" max={engine.getGearLevelCaps(numeric(level,100)).refine[1]??0} value={equipment.gear[0]?.offRefine??0} onChange={(e)=>setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===0?{...slot,offRefine:numeric(e.target.value,0)}:slot)}))} className={inputClass}/></label>
                  <label className="text-[10px] text-zinc-500">Off-hand Enhance<input type="number" min="0" max={engine.getGearLevelCaps(numeric(level,100)).enhance[1]??0} value={equipment.gear[0]?.offEnhance??0} onChange={(e)=>setEquipment((old)=>({...old,gear:old.gear.map((slot,i)=>i===0?{...slot,offEnhance:numeric(e.target.value,0)}:slot)}))} className={inputClass}/></label>
                </div>}
              </div>}
            </div>;
          })}
        </div>
      </details>
      <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Card sockets (18)</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CARD_SOCKETS.map((socket,index)=>{
            const choices=(engine.equipmentCatalog?.cards ?? []).filter((card)=>card.part===socket.part && numeric(level,100)>=socket.levelRequired);
            const selectedCard=choices.find((card)=>card.id===equipment.cards[index]?.id);
            const cardOptions=selectedCard ? engine.getCardCustomization(selectedCard.id,equipment.cards[index]?.star??3) : null;
            return <label key={socket.index} className="text-xs text-zinc-400">{socket.name} · Lv {socket.levelRequired}
              <select value={equipment.cards[index]?.id??0} onChange={(e)=>setEquipment((old)=>{const id=Number(e.target.value);const selected=engine.equipmentCatalog?.cards.find((card)=>card.id===id);return {...old,cards:moveUniqueCardSelection(old.cards,index,id,!!selected?.unique)};})} className={inputClass}>
                <option value="0">Empty</option>{choices.map((card)=><option key={card.id} value={card.id}>{card.name} · Q{card.quality}</option>)}
              </select>
              {selectedCard&&cardOptions&&<div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-[10px] text-zinc-500">Stars<select value={equipment.cards[index]?.star??3} onChange={(e)=>setEquipment((old)=>({...old,cards:old.cards.map((slot,i)=>i===index?{...slot,star:Number(e.target.value)}:slot)}))} className={inputClass}>{[0,1,2,3].map((v)=><option key={v} value={v}>{v}</option>)}</select></label>
                <label className="text-[10px] text-zinc-500">Level<input type="number" min="0" max={cardOptions.maxLevel} value={Math.min(equipment.cards[index]?.level??15,cardOptions.maxLevel)} onChange={(e)=>setEquipment((old)=>({...old,cards:old.cards.map((slot,i)=>i===index?{...slot,level:numeric(e.target.value,15)}:slot)}))} className={inputClass}/></label>
                <label className="flex items-end gap-1 text-[10px] text-zinc-500"><input type="checkbox" disabled={!cardOptions.hasCollection} checked={!!equipment.cards[index]?.flash&&cardOptions.hasCollection} onChange={(e)=>setEquipment((old)=>({...old,cards:old.cards.map((slot,i)=>i===index?{...slot,flash:e.target.checked}:slot)}))}/>Collection</label>
              </div>}
            </label>;
          })}
        </div>
      </details>
      {characterSheet&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {([["P.ATK",103],["M.ATK",104],["P.DEF",105],["M.DEF",106],["HIT",109],["CRIT",111]] as [string,number][]).map(([name,id])=><div key={id} className="rounded-lg bg-black/30 px-3 py-2"><p className="text-[10px] uppercase text-zinc-500">{name}</p><p className="mt-1 text-sm font-semibold text-white">{Number(characterSheet[id]??0).toLocaleString()}</p></div>)}
      </div>}
      <p className="mt-2 text-[11px] text-zinc-500">Selected gear, affixes, stunts and cards feed both the native character sheet and damage simulation. Full legacy equivalence coverage, collection variants and additional legacy build sources remain outstanding.</p>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Defender configuration</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-zinc-400">Level<input type="number" min="1" max="200" value={targetLevel} onChange={(e)=>setTargetLevel(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">P.DEF<input type="number" min="0" value={def} onChange={(e)=>setDef(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">M.DEF<input type="number" min="0" value={mdef} onChange={(e)=>setMdef(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Element ID<input type="number" min="0" value={element} onChange={(e)=>setElement(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Race ID<input type="number" min="0" value={race} onChange={(e)=>setRace(e.target.value)} className={inputClass}/></label>
        <label className="text-xs text-zinc-400">Size ID<input type="number" min="0" value={size} onChange={(e)=>setSize(e.target.value)} className={inputClass}/></label>
      </div>
    </section>
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-semibold text-white">Skill rotation</h2>
      <p className="mt-1 text-xs text-zinc-500">Enter simulator SkillConfig IDs in priority order. Repeated IDs are preserved for cycle mode; disabled IDs are skipped without deleting them from the saved priority list.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-2">
          <label className="block text-xs text-zinc-400">Add Royal Guard skill
            <select value={selectedSkillId} onChange={(e)=>setSelectedSkillId(e.target.value)} className={inputClass}>
              <option value="">Select a learnable damage or modeled buff skill…</option>
              {engine.skillOptions.map((skill)=> <option key={skill.id} value={skill.id}>{skill.name} · Lv {skill.level} · ID {skill.id}</option>)}
            </select>
          </label>
          <button type="button" disabled={!selectedSkillId} onClick={()=>setSkillIds((current)=>current.trim() ? `${current.trim()}, ${selectedSkillId}` : selectedSkillId)} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-40">Add to rotation</button>
          <label className="block text-xs text-zinc-400">Royal Guard rotation preset
            <select value={rotationPreset} onChange={(e)=>e.target.value===""?setRotationPreset(""):applyRotationPreset(Number(e.target.value))} className={inputClass}>
              <option value="">Manual / custom rotation</option>
              {CLASS_PROFILES.royalguard.candidateRotations.map((preset: {name:string}, index: number)=><option key={preset.name} value={index}>{preset.name}</option>)}
            </select>
          </label>
          <label className="block text-xs text-zinc-400">Rotation SkillConfig IDs (priority order; duplicates allowed)
            <input value={skillIds} onChange={(e)=>{setSkillIds(e.target.value);setRotationPreset("");}} placeholder="Select skills above or enter IDs manually" className={inputClass}/>
          </label>
          <label className="block text-xs text-zinc-400">Disabled rotation SkillConfig IDs<input value={disabledRotationIds} onChange={(e)=>setDisabledRotationIds(e.target.value)} placeholder="IDs to skip, comma-separated" className={inputClass}/></label>
          {rotationEntries.length > 0 && <div className="space-y-1 rounded-lg border border-white/10 bg-zinc-950/40 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Rotation priority</p>
            {rotationEntries.map((id, index) => {
              const skill = engine.skillOptions.find((item) => item.id === id);
              const disabled = disabledRotationSet.has(id);
              return <div key={`${id}-${index}`} className="flex items-center gap-2 rounded-md border border-white/5 px-2 py-1.5 text-xs">
                <span className="w-4 text-zinc-500">{index + 1}.</span>
                <span className={`min-w-0 flex-1 truncate ${disabled ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{skill?.name ?? `Skill ${id}`} <span className="text-zinc-500">#{id}</span></span>
                <label className="flex items-center gap-1 text-[10px] text-zinc-400"><input type="checkbox" checked={disabled} onChange={(e)=>setRotationEntryDisabled(id,e.target.checked)}/>Off</label>
                <button type="button" aria-label={`Move skill ${id} up`} disabled={index===0} onClick={()=>moveRotationEntry(index,-1)} className="rounded px-1 text-zinc-300 disabled:opacity-25">↑</button>
                <button type="button" aria-label={`Move skill ${id} down`} disabled={index===rotationEntries.length-1} onClick={()=>moveRotationEntry(index,1)} className="rounded px-1 text-zinc-300 disabled:opacity-25">↓</button>
                <button type="button" aria-label={`Remove skill ${id}`} onClick={()=>removeRotationEntry(index)} className="rounded px-1 text-rose-300">×</button>
              </div>;
            })}
          </div>}
        </div>
        <label className="text-xs text-zinc-400">Duration (ms)<input type="number" min="1000" max="300000" step="1000" value={duration} onChange={(e)=>setDuration(e.target.value)} className={inputClass}/></label>
      </div>
      <div className="mt-3 rounded-lg border border-white/10 bg-zinc-950/50 p-3">
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-zinc-200">Learned skill tree</h3><span className="text-[10px] text-zinc-500">{engine.skillTreeOptions.length} career skills</span></div>
        <p className="mt-1 text-[11px] text-zinc-500">Set learned levels. Passive rows, supported long-duration buffs and mounted-family passives are derived automatically. Short modeled buffs can also be added to the rotation.</p>
        <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {engine.skillTreeOptions.filter((skill)=>skill.kind!=="utility").map((skill)=>(
            <label key={skill.groupId} className="flex items-center justify-between gap-2 rounded-md border border-white/5 px-2 py-1.5 text-xs">
              <span className="min-w-0"><span className="block truncate text-zinc-200">{skill.name}</span><span className="text-[10px] text-zinc-500">{skill.kind} · {skill.groupId}</span></span>
              <select aria-label={skill.name+" learned level"} value={learnedSkillLevels[String(skill.groupId)]??0} onChange={(e)=>setLearnedSkillLevel(skill.groupId,Number(e.target.value))} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100">
                <option value={0}>Not learned</option>
                {skill.levels.map((row)=><option key={row.level} value={row.level}>Lv {row.level}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">Derived passive skills: {learnedSkillEffects.passiveSkillIds.length} · Derived long buffs: {learnedSkillEffects.autoBuffIds.length} · Talent buffs: {talentConfiguration.effects.buffs.length}</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">Always-on buff IDs<input value={activeBuffIds} onChange={(e)=>setActiveBuffIds(e.target.value)} placeholder="BuffConfig IDs, comma-separated" className={inputClass}/></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-300">
        <label className="flex items-center gap-2"><input type="checkbox" checked={rotationCycle} onChange={(e)=>setRotationCycle(e.target.checked)}/>Cycle rotation priority</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={cancelBackswing} onChange={(e)=>setCancelBackswing(e.target.checked)}/>Cancel backswing</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={periodicOff} onChange={(e)=>setPeriodicOff(e.target.checked)}/>Disable periodic buffs</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={ridden} onChange={(e)=>setRidden(e.target.checked)}/>Mounted</label>
      </div>
      <label className="mt-3 block max-w-xs text-xs text-zinc-400">Periodic buff start (seconds)<input type="number" min="0" step="0.1" value={periodicStartSeconds} onChange={(e)=>setPeriodicStartSeconds(e.target.value)} className={inputClass}/></label>
      <p className="mt-2 text-[11px] text-zinc-500">{engine.skillOptions.length} learnable damage / short-buff rotation skills found across Royal Guard's career progression. Empty rotation uses normal attacks only. Skill levels use group IDs, not SkillConfig row IDs.</p>
      <div className="mt-4 grid max-w-lg grid-cols-2 gap-3"><label className="text-xs text-zinc-400">Monte Carlo runs<input type="number" min="100" max="10000" step="100" value={simulationRuns} onChange={(e)=>setSimulationRuns(e.target.value)} className={inputClass}/></label><label className="text-xs text-zinc-400">Random seed<input type="number" min="0" value={simulationSeed} onChange={(e)=>setSimulationSeed(e.target.value)} className={inputClass}/></label></div><button type="button" disabled={!engine.ready} onClick={runSimulation} className="mt-4 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">{engine.ready ? "Run native simulation" : "Engine loading…"}</button>
      {simulationError && <p role="alert" className="mt-3 text-sm text-rose-300">{simulationError}</p>}
    </section>
    {result && distributionSummary && <section aria-live="polite" className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-white">Native damage report</h2><p className="mt-1 text-xs text-zinc-500">Run {runCount} · {result.runs.toLocaleString()} Monte Carlo trials · {result.durationMs.toLocaleString()} ms · Seed {simulationSeed}</p></div><div className="flex items-center gap-2"><button type="button" onClick={()=>setBaselineResult(result)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5">Pin baseline</button>{baselineResult && <button type="button" onClick={()=>setBaselineResult(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5">Clear</button>}<span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Not live-game verified</span></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([["Mean damage",distributionSummary.mean],["Mean DPS",distributionSummary.mean*1000/result.durationMs],["p5 damage",distributionSummary.p5],["p95 damage",distributionSummary.p95],["Expected damage",result.expectedTotal],["Burst 5s DPS",result.deterministic.burst5sDps]] as [string,number][]).map(([k,v])=><div key={k} className="rounded-lg bg-zinc-950/70 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</p><p className="mt-1 text-lg font-semibold tabular-nums text-white">{Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}</p></div>)}
      </div>
{baselineSummary && <div className="mt-3 rounded-lg border border-white/10 bg-zinc-950/50 p-3"><p className="text-xs font-semibold text-zinc-300">Pinned baseline comparison · DPS change</p><p className="mt-1 text-xs text-zinc-500">Mean: {baselineSummary.mean>0?(((distributionSummary.mean*1000/result.durationMs)/(baselineSummary.mean*1000/baselineResult!.durationMs)-1)*100).toFixed(1)+"%":"—"} · p5: {baselineSummary.p5>0?(((distributionSummary.p5*1000/result.durationMs)/(baselineSummary.p5*1000/baselineResult!.durationMs)-1)*100).toFixed(1)+"%":"—"} · p95: {baselineSummary.p95>0?(((distributionSummary.p95*1000/result.durationMs)/(baselineSummary.p95*1000/baselineResult!.durationMs)-1)*100).toFixed(1)+"%":"—"}</p></div>}<p className="mt-3 text-xs text-zinc-500">Median {distributionSummary.p50.toLocaleString(undefined,{maximumFractionDigits:2})} · Standard deviation {distributionSummary.sd.toLocaleString(undefined,{maximumFractionDigits:2})} · Mean crit rate {(distributionSummary.critPct*100).toFixed(1)}%. Cast timing is deterministic; damage rolls and crits use the simulator seeded Monte Carlo engine.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg bg-zinc-950/70 p-3"><h3 className="text-xs font-semibold text-zinc-300">Total damage distribution</h3><div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label="Histogram of total damage across Monte Carlo trials">{distributionSummary.histogram.map((count,index)=><div key={index} title={count+" trials"} className="min-w-0 flex-1 rounded-t-sm bg-cyan-400/70" style={{height:(count/Math.max(1,...distributionSummary.histogram)*100)+"%"}} />)}</div><div className="mt-2 flex justify-between text-[10px] text-zinc-500"><span>{distributionSummary.min.toLocaleString(undefined,{maximumFractionDigits:0})}</span><span>p5 {distributionSummary.p5.toLocaleString(undefined,{maximumFractionDigits:0})}</span><span>mean {distributionSummary.mean.toLocaleString(undefined,{maximumFractionDigits:0})}</span><span>p95 {distributionSummary.p95.toLocaleString(undefined,{maximumFractionDigits:0})}</span><span>{distributionSummary.max.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div></section>
        <section className="rounded-lg bg-zinc-950/70 p-3"><h3 className="text-xs font-semibold text-zinc-300">Damage over time · mean DPS</h3><div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label="Mean damage per second over time">{distributionSummary.timeBuckets.map((bucket,index)=><div key={index} title={(bucket.startMs/1000).toFixed(1)+"s · "+bucket.dps.toLocaleString(undefined,{maximumFractionDigits:0})+" DPS"} className="min-w-0 flex-1 rounded-t-sm bg-sky-400/70" style={{height:(bucket.dps/Math.max(1,...distributionSummary.timeBuckets.map((item)=>item.dps))*100)+"%"}} />)}</div><div className="mt-2 flex justify-between text-[10px] text-zinc-500"><span>0s</span><span>{(result.durationMs/2000).toFixed(0)}s</span><span>{(result.durationMs/1000).toFixed(0)}s</span></div></section>
      </div>
      <details open className="mt-4"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Skill breakdown ({distributionSummary.skills.length})</summary><div className="mt-2 overflow-x-auto rounded-lg bg-zinc-950/70"><table className="w-full min-w-[620px] text-left text-[11px]"><thead className="text-zinc-500"><tr><th className="px-3 py-2">Skill</th><th className="px-3 py-2 text-right">Hits / fight</th><th className="px-3 py-2 text-right">Avg / hit</th><th className="px-3 py-2 text-right">Hit</th><th className="px-3 py-2 text-right">Crit</th><th className="px-3 py-2 text-right">Damage share</th></tr></thead><tbody className="divide-y divide-white/5">{distributionSummary.skills.map((skill)=><tr key={skill.id}><td className="px-3 py-2 text-zinc-200">{skill.name}</td><td className="px-3 py-2 text-right tabular-nums">{(skill.landed/result.runs).toFixed(1)}</td><td className="px-3 py-2 text-right tabular-nums">{skill.landed?(skill.total*result.runs/skill.landed).toLocaleString(undefined,{maximumFractionDigits:1}):"—"}</td><td className="px-3 py-2 text-right tabular-nums">{(skill.hitPct*100).toFixed(1)}%</td><td className="px-3 py-2 text-right tabular-nums">{skill.magic?"—":(skill.critPct*100).toFixed(1)+"%"}</td><td className="px-3 py-2 text-right tabular-nums">{(skill.share*100).toFixed(1)}%</td></tr>)}</tbody></table></div></details>
            <details className="mt-4"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Cast timeline ({result.deterministic.castLog.length} entries)</summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-lg bg-zinc-950/70 p-2">
          {result.deterministic.castLog.length ? <div className="divide-y divide-white/5">{result.deterministic.castLog.map((entry,index)=>{const event=entry as Record<string,unknown>;const time=Number(event.t??0);const hits=Array.isArray(event.hits)?event.hits as number[]:[];const lock=Number(event.lockMs??event.durMs??0);return <div key={index} className="grid grid-cols-[64px_70px_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 text-[11px]">
            <span className="font-mono tabular-nums text-zinc-500">{(time/1000).toFixed(2)}s</span>
            <span className="rounded bg-white/5 px-1.5 py-1 text-center text-zinc-400">{String(event.kind??"event")}</span>
            <span className="min-w-0 truncate text-zinc-200">{String(event.name??"Combat event")}{hits.length>0?" · "+hits.length+" hit"+(hits.length===1?"":"s"):""}</span>
            <span className="text-right tabular-nums text-zinc-500">{lock>0?(lock/1000).toFixed(2)+"s":"—"}</span>
          </div>;})}</div> : <p className="p-3 text-xs text-zinc-500">No cast events recorded.</p>}
        </div>
      </details>
      <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Sample damage events ({result.deterministic.sampleTimeline.length})</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-950/70 p-2">
          {result.deterministic.sampleTimeline.length ? <div className="divide-y divide-white/5">{result.deterministic.sampleTimeline.map((entry,index)=>{const event=entry as Record<string,unknown>;return <div key={index} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2 px-2 py-2 text-[11px]"><span className="font-mono text-zinc-500">{(Number(event.timeMs??0)/1000).toFixed(2)}s</span><span className="truncate text-zinc-300">{String(event.skill??"Damage event")}</span><span className="tabular-nums text-zinc-100">{Number(event.expectedDmg??0).toLocaleString()}</span></div>;})}</div> : <p className="p-3 text-xs text-zinc-500">No sample damage events recorded.</p>}
        </div>
      </details>
      {result.sampleRun && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-zinc-300">Sample rolled hits · trial 1 ({result.sampleRun.length} events)</summary><div className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-950/70 p-2">{result.sampleRun.slice(0,120).map((event,index)=><div key={index} className="grid grid-cols-[64px_minmax(0,1fr)_auto_auto] gap-2 border-b border-white/5 px-2 py-1.5 text-[11px]"><span className="font-mono text-zinc-500">{(Number(event.t??0)/1000).toFixed(2)}s</span><span className="truncate text-zinc-300">{String(event.name??"Hit")}</span><span className="tabular-nums text-zinc-100">{Number(event.damage??0).toLocaleString()}</span><span className="text-zinc-500">{event.miss?"Miss":event.crit?"Crit":"Hit"}</span></div>)}</div></details>}
    </section>}
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 text-xs leading-5 text-zinc-500">
      {profilesLoading ? "Loading active guild profiles…" : profilesError ? profilesError : `${members.length} active guild profiles available.`}
      <p className="mt-1">Selected guild profiles are currently reference-only. Legacy import supports v15 Royal Guard tabs and reports unsupported fields; complete advanced-system parity remains outstanding. Native saved builds are local to this browser. The production iframe is untouched.</p>
    </div>
  </div>;
}
