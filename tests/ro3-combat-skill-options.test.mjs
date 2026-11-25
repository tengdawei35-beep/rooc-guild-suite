import test from "node:test";
import assert from "node:assert/strict";
import { getCombatSkillOptions } from "../src/lib/ro3-combat-simulator/skill-options.ts";

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
