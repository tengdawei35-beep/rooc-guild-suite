import test from "node:test";
import assert from "node:assert/strict";
import { loadRo3GameData } from "../src/lib/ro3-combat-simulator/data/ro3-game-data";
import { createRo3CombatDataStore } from "../src/lib/ro3-combat-simulator/create-data-store";
import { petStats } from "../src/lib/ro3-combat-simulator/engine/ro3-damage-engine.mjs";

test("full exported game data decompresses and contains simulator tables", async () => {
  const exported = await loadRo3GameData();
  assert.ok(Object.keys(exported.tables).length > 20);
  assert.ok(exported.tables.JobConfig);
  assert.ok(exported.tables.SkillConfig);
  assert.ok(exported.tables.ItemConfig);
});

test("in-memory combat store uses full exported career and skill data", async () => {
  const data = await createRo3CombatDataStore();
  assert.ok(data.row("JobConfig", 1410));
  assert.ok(data.row("SkillConfig", 1160805));
  assert.ok(data.row("ItemConfig", 0) === null || data.row("ItemConfig", 0) === undefined);
});

test("native pet stat inputs use the legacy PetDigest and PetGrowth calculations", async () => {
  const data = await createRo3CombatDataStore();
  const pet = Object.values(data.table("PetDigest")).find((row) => Number(row._iID) > 0 && Number(row.g) > 0);
  assert.ok(pet, "exported PetDigest should contain a usable pet");
  const id = Number(pet._iID);
  const growthId = Number(pet.g);
  const deployed = [{ id, lv: 1, star: 1, stage: 0 }];
  const support = [{ g: growthId, lv: 1, star: 1, stage: 0 }];
  const first = petStats(deployed, support, 200, data);
  const second = petStats(deployed, support, 200, data);
  assert.deepEqual(first, second, "pet attribute mapping should be deterministic");
  assert.ok(first.every(([attribute, value]) => Number.isFinite(attribute) && Number.isFinite(value)));
});
