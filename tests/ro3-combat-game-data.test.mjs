import test from "node:test";
import assert from "node:assert/strict";
import { loadRo3GameData } from "../src/lib/ro3-combat-simulator/data/ro3-game-data";
import { createRo3CombatDataStore } from "../src/lib/ro3-combat-simulator/create-data-store";

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
