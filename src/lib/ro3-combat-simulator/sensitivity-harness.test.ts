import assert from "node:assert/strict";
import testCase from "node:test";
import { buildSensitivityReport, REFERENCE_LEVEL, simulatorEngineSha256 } from "./sensitivity-harness";

testCase("sensitivity harness pins both attacker and defender at Level 99", () => {
  const report = buildSensitivityReport();
  assert.equal(REFERENCE_LEVEL, 99);
  assert.equal(report.attackerAndDefenderLevel, 99);
  assert.equal(report.defender.level, 99);
  assert.match(simulatorEngineSha256, /^[a-f0-9]{64}$/);
});

testCase("fixed physical and magic profiles produce finite deterministic damage", () => {
  const first = buildSensitivityReport();
  const second = buildSensitivityReport();
  assert.deepEqual(first.sensitivity, second.sensitivity);
  assert.ok(first.sensitivity.every((row) =>
    Number.isFinite(row.baselineDamage) &&
    Number.isFinite(row.changedDamage) &&
    row.baselineDamage > 0
  ));
  assert.ok(first.sensitivity.some((row) => row.channel === "physical" && row.input.startsWith("PATK")));
  assert.ok(first.sensitivity.some((row) => row.channel === "magic" && row.input.startsWith("MATK")));
});

testCase("supported offensive inputs increase damage in their matching channel", () => {
  const report = buildSensitivityReport();
  for (const row of report.sensitivity) {
    assert.ok(row.changedDamage > row.baselineDamage, `${row.channel} ${row.input} should increase damage`);
  }
});

testCase("physical and magic damage bonuses share the evaluator's additive sheet bracket", () => {
  const report = buildSensitivityReport();
  for (const row of report.overlappingBonusTests) {
    assert.ok(row.combinedDamage > row.primaryOnlyDamage);
    assert.ok(row.combinedDamage > row.generalOnlyDamage);
    assert.ok(Math.abs(row.combinedPercentChange - 20) < 0.1,
      `${row.channel} combined uplift expected ~20%, got ${row.combinedPercentChange}%`);
  }
});

testCase("target PDEF/MDEF sensitivity is measured separately from attacker offensive stats", () => {
  const report = buildSensitivityReport();
  assert.equal(report.targetDefenceSensitivity.length, 2);
  assert.ok(report.targetDefenceSensitivity.every((row) => row.changedDamage > row.baselineDamage));
  assert.ok(report.targetDefenceSensitivity.some((row) => row.input === "Target PDEF (105)"));
  assert.ok(report.targetDefenceSensitivity.some((row) => row.input === "Target MDEF (106)"));
});

testCase("synthetic 10% stat probes produce the expected 10% outgoing damage change", () => {
  const report = buildSensitivityReport();
  for (const row of report.sensitivity) {
    assert.equal(row.percentChange, 10, `${row.channel} ${row.input} should produce a 10% probe response`);
    assert.equal(row.baselineDamage, 5000);
    assert.equal(row.changedDamage, 5500);
  }
});

testCase("a 10% target defence reduction produces the expected 5.26% damage increase", () => {
  const report = buildSensitivityReport();
  for (const row of report.targetDefenceSensitivity) {
    assert.equal(row.baselineDamage, 5000);
    assert.equal(row.changedDamage, 5263);
    assert.equal(row.percentChange, 5.26);
  }
});

testCase("critical damage modifier is isolated behind guaranteed physical criticals", () => {
  const report = buildSensitivityReport();
  const row = report.criticalDamageSensitivity;
  assert.equal(row.input, "Critical Damage (209)");
  assert.equal(row.baselineDamage, 7500);
  assert.equal(row.changedDamage, 8000);
  assert.equal(row.percentChange, 6.6667);
});
