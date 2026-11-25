import test from "node:test";
import assert from "node:assert/strict";
import { validateCombatInput } from "../src/lib/ro3-combat-simulator/validate-input.mjs";

const valid = {
  level: "100", stats: ["80", "60", "50", "20", "80", "20"],
  defenderLevel: "100", pdef: "5000", mdef: "3000", element: "1",
  race: "1", size: "2", durationMs: "30000", skillIds: "1160805, 1160806",
};

test("native input validation accepts a complete baseline and parses ordered skill IDs", () => {
  const result = validateCombatInput(valid);
  assert.deepEqual(result.stats, [80, 60, 50, 20, 80, 20]);
  assert.deepEqual(result.skillIds, [1160805, 1160806]);
  assert.equal(result.durationMs, 30000);
});

test("native input validation rejects blank, fractional, and out-of-range character values", () => {
  assert.throws(() => validateCombatInput({ ...valid, level: "" }), /Attacker level is required/);
  assert.throws(() => validateCombatInput({ ...valid, level: "100.5" }), /Attacker level must be a whole number/);
  assert.throws(() => validateCombatInput({ ...valid, stats: ["100", ...valid.stats.slice(1)] }), /STR must be a whole number/);
  assert.throws(() => validateCombatInput({ ...valid, defenderLevel: "201" }), /Defender level must be a whole number/);
});

test("native input validation rejects negative defenses, invalid IDs, and duration bounds", () => {
  assert.throws(() => validateCombatInput({ ...valid, pdef: "-1" }), /P.DEF must be a whole number/);
  assert.throws(() => validateCombatInput({ ...valid, element: "-1" }), /Element ID must be a whole number/);
  assert.throws(() => validateCombatInput({ ...valid, durationMs: "999" }), /Duration must be a whole number/);
  assert.throws(() => validateCombatInput({ ...valid, skillIds: "123, nope" }), /Skill IDs must be positive whole numbers/);
  assert.throws(() => validateCombatInput({ ...valid, skillIds: "0" }), /Skill IDs must be positive whole numbers/);
});
