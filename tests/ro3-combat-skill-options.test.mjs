import test from "node:test";
import assert from "node:assert/strict";
import { getCombatSkillOptions, getCombatSkillTreeOptions, deriveLearnedSkillEffects } from "../src/lib/ro3-combat-simulator/skill-options.ts";

test("skill options mirror the selected career ancestry and choose highest learnable damage rank", () => {
  const ui = {
    jobs: [{ id: 1100 }, { id: 1400, parent: 1100 }, { id: 1410, parent: 1400 }, { id: 1200 }],
    trees: { "1100": [[11001]], "1400": [[14001]], "1410": [[14101]], "1200": [[12001]] },
  };
  const table = {
    "1100101": { _iID: 1100101, _iSkillID: 11001, _iLevel: 1, _iBasicType: 1, _kDamageParam1: [100], name: "Bash Lv1" },
    "1100110": { _iID: 1100110, _iSkillID: 11001, _iLevel: 10, _iBasicType: 1, _kDamageParam1: [200], name: "Bash Lv10" },
    "1400110": { _iID: 1400110, _iSkillID: 14001, _iLevel: 10, _iBasicType: 1, _kDamageParam1: [300], name: "Crusader Strike" },
    "1410110": { _iID: 1410110, _iSkillID: 14101, _iLevel: 10, _iBasicType: 1, _kDamageParam1: [400], name: "Royal Guard Strike" },
    "1200110": { _iID: 1200110, _iSkillID: 12001, _iLevel: 10, _iBasicType: 1, _kDamageParam1: [500], name: "Fire Bolt" },
    "1410201": { _iID: 1410201, _iSkillID: 14102, _iLevel: 1, _iBasicType: 0, _kAttri: [[1, 2]], name: "Passive" },
    "1410301": { _iID: 1410301, _iSkillID: 14103, _iLevel: 1, _iBasicType: 1, _kDamageParam1: [100], _bAlt: true, name: "Follow-up" },
  };
  const options = getCombatSkillOptions(ui, table, 1410);
  assert.deepEqual(options.map((option) => option.id).sort((a,b)=>a-b), [1100110,1400110,1410110]);
  assert.equal(options.find((option) => option.groupId === 11001)?.level, 10);
});

import { loadRo3GameData } from "../src/lib/ro3-combat-simulator/data/ro3-game-data";

test("full exported dataset produces Royal Guard career skill options", async () => {
  const exported = await loadRo3GameData();
  const options = getCombatSkillOptions(
    exported.ui,
    exported.tables.SkillConfig,
    1410,
  );
  assert.ok(options.length > 0, "Royal Guard career tree should expose learnable damage skills");
  assert.equal(new Set(options.map((option) => option.groupId)).size, options.length);
  assert.ok(options.every((option) => option.id > 0 && option.level > 0));
});

test("skill tree options include passive and buff skills and derive learned effects", () => {
  const ui = {
    jobs: [{ id: 1100 }, { id: 1410, parent: 1100 }],
    trees: { "1100": [[11001]], "1410": [[14101, 14102, 14103]] },
  };
  const table = {
    "1100101": { _iID: 1100101, _iSkillID: 11001, _iLevel: 1, _iBasicType: 1, _kDamageParam1: [100], name: "Bash" },
    "1410101": { _iID: 1410101, _iSkillID: 14101, _iLevel: 1, _iBasicType: 0, _kAttri: [[103, 50]], name: "Royal Guard Passive" },
    "1410102": { _iID: 1410102, _iSkillID: 14102, _iLevel: 1, _iBasicType: 1, _kBuff1: [[9001, 1, 120000]], name: "Long Blessing" },
    "1410103": { _iID: 1410103, _iSkillID: 14103, _iLevel: 1, _iBasicType: 1, _kBuff1: [[9002, 1, 10000]], name: "Short Buff" },
  };
  const buffTable = { "9001": { _kChangeAttri: [[103, 500]] }, "9002": { _kChangeAttri: [[103, 100]] } };
  const options = getCombatSkillTreeOptions(ui, table, 1410, buffTable);
  assert.deepEqual(options.map((option) => option.kind).sort(), ["buff", "buff", "damage", "passive"]);
  const effects = deriveLearnedSkillEffects(options, { "14101": 1, "14102": 1, "14103": 1 }, buffTable, true);
  assert.deepEqual(effects.passiveSkillIds, [1410101]);
  assert.deepEqual(effects.autoBuffIds, [9001]);
});
