import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NATIVE_SAVED_BUILDS,
  isNativeBuildDraft,
  parseNativeSavedBuilds,
  removeNativeSavedBuild,
  serializeNativeSavedBuilds,
  upsertNativeSavedBuild,
} from "../src/lib/ro3-combat-simulator/native-build-storage";

const draft = {
  level: "100", stats: ["80", "60", "50", "20", "80", "20"],
  equipment: {
    gear: Array.from({ length: 7 }, () => ({ id: 0, roll: 5000, refine: 0, enhance: 0, affixes: [], stunts: [], offRefine: 0, offEnhance: 0 })),
    cards: Array.from({ length: 18 }, () => ({ id: 0, star: 3, level: 15, flash: false })),
  },
  pets: [null, null, null, null], assistPets: [null, null, null],
  enchantAttrs: [], extraAttrInput: "", petCollectionAttrInput: "", attackerElement: "1", bondBonusBp: "0", simulationRuns: "3000", simulationSeed: "20260101", emblemAttrInput: "", totemLoadoutInput: "", totemLevel: "0", totemSkillIds: "", totemAttrInput: "", totemEnhanceBp: "0",
  resonanceRefine: "0", resonanceEnhance: "0", talentLevel: "0", talentProf: "0", talentPicks: {},
  passiveSkillIds: "", talentSkillLevels: "", activeBuffIds: "", skillLevels: "", rotationCycle: false,
  cancelBackswing: false, periodicOff: false, periodicStartSeconds: "0", ridden: false, def: "5000", mdef: "3000", targetLevel: "100",
  element: "1", race: "1", size: "2", skillIds: "", disabledRotationIds: "", duration: "30000",
};
const build = (id, updatedAt) => ({
  id, name: `Build ${id}`, updatedAt, state: structuredClone(draft),
});

test("validates complete native build drafts and rejects malformed state", () => {
  assert.equal(isNativeBuildDraft(draft), true);
  assert.equal(isNativeBuildDraft({ ...draft, stats: ["1"] }), false);
  assert.equal(isNativeBuildDraft({ ...draft, equipment: { gear: [], cards: [] } }), false);
});

test("serializes and parses versioned saved builds without losing inputs", () => {
  const builds = [build("one", "2026-11-26T00:00:00.000Z")];
  const parsed = parseNativeSavedBuilds(serializeNativeSavedBuilds(builds));
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].state, draft);
  assert.equal(parsed[0].name, "Build one");
});

test("deduplicates IDs, skips invalid entries and limits restored builds", () => {
  const entries = Array.from({ length: MAX_NATIVE_SAVED_BUILDS + 2 }, (_, i) => build(String(i), new Date(2026, 0, i + 1).toISOString()));
  const raw = serializeNativeSavedBuilds(entries);
  assert.equal(parseNativeSavedBuilds(raw).length, MAX_NATIVE_SAVED_BUILDS);
  assert.deepEqual(parseNativeSavedBuilds("not-json"), []);
  assert.deepEqual(parseNativeSavedBuilds(JSON.stringify({ version: 2, builds: entries })), []);
});

test("upserts newest builds first and removes selected builds", () => {
  const first = build("one", "2026-11-25T00:00:00.000Z");
  const second = build("two", "2026-11-26T00:00:00.000Z");
  assert.deepEqual(upsertNativeSavedBuild([first], second).map((item) => item.id), ["two", "one"]);
  assert.deepEqual(removeNativeSavedBuild([first, second], "one").map((item) => item.id), ["two"]);
});
