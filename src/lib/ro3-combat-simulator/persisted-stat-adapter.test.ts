import assert from "node:assert/strict";
import testCase from "node:test";
import { persistedRo3StatsToSimulatorAttributes } from "./persisted-stat-adapter";

testCase("Direct core stats retain simulator attribute values", () => {
  const result = persistedRo3StatsToSimulatorAttributes({
    hp: 120000,
    patk: 18500,
    matk: 17200,
    pdef: 9000,
    mdef: 8200,
  });
  assert.deepEqual(result.attributes, {
    101: 120000,
    103: 18500,
    104: 17200,
    105: 9000,
    106: 8200,
  });
  assert.deepEqual(result.excluded, []);
});

testCase("OCR percentage values convert to simulator basis points", () => {
  const result = persistedRo3StatsToSimulatorAttributes({
    critDamagePercent: 15,
    physicalDamageBonusPercent: 12.5,
    magicDamageBonusPercent: 8,
    damageIncreasePercent: 4.25,
  });
  assert.deepEqual(result.attributes, {
    209: 1500,
    211: 1250,
    213: 800,
    215: 425,
  });
});

testCase("Unverified and unsupported fields are excluded instead of guessed", () => {
  const result = persistedRo3StatsToSimulatorAttributes({
    physicalPenetrationPercent: 30,
    damageReductionPercent: 20,
    damageVsMedium: 15,
    damageVsDemiHuman: 10,
  });
  assert.deepEqual(result.attributes, {});
  assert.equal(result.excluded.length, 4);
  assert.ok(result.excluded.every((item) => item.reason.length > 0));
});

testCase("Null, empty, invalid, and negative values are not emitted", () => {
  const result = persistedRo3StatsToSimulatorAttributes({
    patk: null,
    matk: "",
    pdef: "not-a-number",
    mdef: -1,
  });
  assert.deepEqual(result.attributes, {});
  assert.deepEqual(result.excluded, []);
});
