import type { NativeBuildDraft } from "./native-build-storage";

export type LegacySkillOption = { groupId: number; id: number; level: number };

export type LegacyImportResult = {
  draft: NativeBuildDraft | null;
  warnings: string[];
  unsupported: string[];
};

/**
 * Maps a current (v15) legacy iframe build tab into the native Royal Guard draft.
 * Deliberately rejects other careers and legacy schema versions rather than silently
 * applying an incomplete migration. The caller supplies the current native draft as
 * defaults so newly-added fields remain valid.
 */
export function importLegacyRoyalGuardBuild(
  raw: unknown,
  defaults: NativeBuildDraft,
  skillOptions: LegacySkillOption[],
): LegacyImportResult {
  const warnings: string[] = [];
  const unsupported: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { draft: null, warnings, unsupported: ["Invalid legacy build state."] };
  }
  const state = raw as Record<string, any>;
  if (state.v !== 15) return { draft: null, warnings, unsupported: [`Legacy state version ${String(state.v ?? "unknown")} is not supported; export or load it in the legacy simulator first so it is upgraded to v15.`] };
  if (Number(state.job) !== 1410) return { draft: null, warnings, unsupported: [`Career ${String(state.job)} is not supported by the current native preview. Only Royal Guard (1410) can be imported.`] };

  const draft: NativeBuildDraft = JSON.parse(JSON.stringify(defaults));
  const numberString = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? String(Number(value)) : String(fallback);
  const skillIdFor = (group: number, level: number) => {
    const candidates = skillOptions.filter((item) => item.groupId === group);
    if (level <= 0) return undefined;
    return candidates.filter((item) => item.level <= level).sort((a,b)=>b.level-a.level)[0]?.id;
  };

  draft.level = numberString(state.level, 100);
  if (Array.isArray(state.stats) && state.stats.length === 6) draft.stats = state.stats.map((v: unknown)=>numberString(v,0));
  else warnings.push("Base stats were left at native defaults because the legacy stat array was invalid.");

  const gear = Array.isArray(state.gear) ? state.gear : [];
  if (gear.length) {
    draft.equipment.gear = draft.equipment.gear.map((slot, index) => {
      const source = gear[index];
      if (!source || typeof source !== "object") return slot;
      return {
        ...slot,
        id: Number(source.id) || 0,
        roll: Number.isFinite(Number(source.roll)) ? Number(source.roll) : slot.roll,
        refine: Number(source.refine) || 0,
        enhance: Number(source.enh) || 0,
        affixes: Array.isArray(source.aff) ? source.aff.map(Number).filter(Number.isFinite).slice(0,2) : [],
        stunts: Array.isArray(source.sp) ? source.sp.map(Number).filter(Number.isFinite).slice(0,2) : [],
        offRefine: index === 0 ? Number(source.offRefine) || 0 : slot.offRefine,
        offEnhance: index === 0 ? Number(source.offEnh) || 0 : slot.offEnhance,
      };
    });
  }
  const cards = Array.isArray(state.cards) ? state.cards : [];
  if (cards.length) draft.equipment.cards = draft.equipment.cards.map((slot,index) => {
    const source=cards[index];
    return source && typeof source==="object" ? {
      id:Number(source.id)||0, star:Number(source.star)||0, level:Number(source.lv)||0, flash:!!source.flash,
    } : slot;
  });

  if (Array.isArray(state.pets)) draft.pets = draft.pets.map((slot,index) => {
    const source=state.pets[index];
    return source && typeof source==="object" ? { id:Number(source.id)||0, lv:Number(source.lv)||0, star:Number(source.star)||1, stage:Number(source.stage)||0 } : null;
  });
  if (Array.isArray(state.assist)) {
    draft.assistPets = draft.assistPets.map((slot,index) => {
      const source=state.assist[index];
      return source && typeof source==="object" ? { g:Number(source.g)||0, lv:Number(source.lv)||0, star:Number(source.star)||1, stage:Number(source.stage)||0 } : null;
    });
    if (state.assist.slice(draft.assistPets.length).some((slot: any)=>slot && Number(slot.g)>0)) unsupported.push("Additional legacy support-pet slots beyond the three native slots are not mapped.");
  }

  const skills = state.skills && typeof state.skills==="object" ? state.skills as Record<string,unknown> : {};
  draft.skillLevels = Object.entries(skills).map(([group,level])=>`${group}:${Number(level)||0}`).join(", ");
  draft.talentSkillLevels = draft.skillLevels;
  const rotation = Array.isArray(state.rotation) ? state.rotation : [];
  const unmappedRotation: number[] = [];
  draft.skillIds = rotation.flatMap((group: unknown) => {
    const id=skillIdFor(Number(group),Number(skills[String(group)]||0));
    if (!id && Number(skills[String(group)]||0) > 0) unmappedRotation.push(Number(group));
    return id ? [id] : [];
  }).join(", ");
  if (unmappedRotation.length) unsupported.push(`Rotation skills could not be mapped to native supported skill rows: ${[...new Set(unmappedRotation)].join(", ")}.`);
  const disabled = Array.isArray(state.disabledRotation) ? state.disabledRotation : [];
  draft.disabledRotationIds = disabled.flatMap((group: unknown) => {
    const id=skillIdFor(Number(group),Number(skills[String(group)]||0));
    return id ? [id] : [];
  }).join(", ");

  draft.talentLevel = numberString(state.talents?.lv,0);
  draft.talentProf = numberString(state.talents?.prof ?? state.prof,0);
  draft.talentPicks = state.talents?.picks && typeof state.talents.picks==="object"
    ? Object.fromEntries(Object.entries(state.talents.picks).map(([key,value])=>[key,Array.isArray(value)?[Number(value[0])||0,Number(value[1])||0]:[0,0]]))
    : {};
  draft.resonanceRefine = numberString(state.res?.refine,0);
  draft.resonanceEnhance = numberString(state.res?.enhance,0);
  draft.rotationCycle = !!state.sim?.cycle;
  draft.cancelBackswing = !!state.sim?.cancel;
  draft.periodicOff = Number(state.sim?.howl) < 0;
  draft.periodicStartSeconds = numberString(Math.max(0,Number(state.sim?.howl)||0),0);
  draft.ridden = Number(state.sim?.howl) < 0;
  draft.duration = numberString((Number(state.sim?.seconds) || 30) * 1000,30000);
  draft.def = numberString(state.target?.def,0);
  draft.mdef = numberString(state.target?.mdef,0);
  draft.targetLevel = numberString(state.target?.level,100);
  draft.element = numberString(state.target?.element,1);
  draft.race = numberString(state.target?.race,1);
  draft.size = numberString(state.target?.size,2);

  if (state.ex && Object.keys(state.ex).length) unsupported.push("Legacy typed/aggregated attribute bonuses (ex) are not mapped because the native preview does not yet have a semantically equivalent general equipment-attribute input.");
  if (state.hold && Object.keys(state.hold).length) unsupported.push("Legacy held/final stat values are not mapped.");
  if (state.echoes?.length || state.echoAttrs?.length) unsupported.push("Legacy Echo/emblem attribute state is not mapped.");
  if (state.totems?.length || Number(state.totemLv)>0) unsupported.push("Legacy totem selections and levels are not mapped.");
  if (state.petCollect?.length) unsupported.push("Legacy pet collection bonuses are not mapped.");
  if (state.bonus?.boss) warnings.push("Legacy boss-damage bonus is not currently represented in the native draft.");
  if (state.talents?.lv) warnings.push("Talent picks and levels were imported, but talent effects remain inactive when the authorized TalentDigest data is unavailable.");
  warnings.push("Only current v15 Royal Guard states are accepted. Legacy versions must first be opened and saved by the iframe so its own migrations run.");
  return { draft, warnings, unsupported };
}

export function parseLegacyBuildBook(raw: string | null): Array<{ id: number; name: string; state: unknown }> {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const book = parsed as Record<string, any>;
    if (book.v !== 1 || !Array.isArray(book.builds)) return [];
    const seen = new Set<number>();
    return book.builds.flatMap((entry: any) => {
      if (!entry || !Number.isInteger(entry.id) || seen.has(entry.id) || !entry.state || typeof entry.state !== "object") return [];
      seen.add(entry.id);
      return [{ id: entry.id, name: String(entry.name || `Legacy Build ${entry.id}`).slice(0, 28), state: entry.state }];
    }).slice(0,8);
  } catch {
    return [];
  }
}
