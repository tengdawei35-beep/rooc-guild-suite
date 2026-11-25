import assert from "node:assert/strict";
import testCase from "node:test";
import {
  calculateRo3MemberScores,
  calculateRo3PvPScore,
  calculateRo3Score,
} from "./scoring";

testCase("Tank score keeps HP at a fixed 5% and scales the other components to 95%", () => {
  const result = calculateRo3Score("TANK", {
    hp: 100,
    defence: 100,
    damageReduction: 100,
    pvpSurvivability: 100,
    criticalResilience: 100,
  });
  assert.equal(result.score, 100);
  assert.equal(result.contributions.hp, 5);
  assert.equal(result.contributions.defence, 28.5);
  assert.equal(result.contributions.damageReduction, 23.75);
  assert.equal(result.contributions.pvpSurvivability, 23.75);
  assert.equal(result.contributions.criticalResilience, 19);
});

testCase("Tank score is unavailable when fixed-weight HP is missing", () => {
  const result = calculateRo3Score("TANK", {
    defence: 100,
    damageReduction: 100,
    pvpSurvivability: 100,
    criticalResilience: 100,
  });
  assert.equal(result.score, null);
  assert.ok(result.missingComponents.includes("hp"));
});

testCase("Tank defensive weights rebalance only inside the 95% allocation", () => {
  const result = calculateRo3Score("TANK", {
    hp: 100,
    defence: 50,
    damageReduction: 100,
  });
  assert.equal(result.score, 81.25);
  assert.equal(result.contributions.hp, 5);
  assert.equal(result.contributions.defence, 28.5 * 0.95);
  assert.equal(result.contributions.damageReduction, 23.75 * 0.95);
});

testCase("DPS PvP score is 60% DPS plus 40% Tank", () => {
  const result = calculateRo3PvPScore("Ranger", 80, 50);
  assert.equal(result.score, 68);
  assert.deepEqual(result.contributions, { tank: 20, dps: 48 });
});

testCase("Archbishop PvP score is Tank only", () => {
  const result = calculateRo3PvPScore("Archbishop", null, 73);
  assert.equal(result.score, 73);
  assert.deepEqual(result.weights, { tank: 100 });
  assert.deepEqual(result.contributions, { tank: 73 });
});

testCase("DPS PvP score is unavailable when either underlying score is missing", () => {
  const result = calculateRo3PvPScore("Mechanic", 80, null);
  assert.equal(result.score, null);
  assert.deepEqual(result.missingComponents, ["tank"]);
});

testCase("Member composition selects Magic DPS by default for Warlock", () => {
  const result = calculateRo3MemberScores({
    job: "Warlock",
    dpsComponents: { attackPower: 100, penetration: 100, damageAmplification: 100, targetBonuses: 100 },
    tankComponents: { hp: 100, defence: 100, damageReduction: 100, pvpSurvivability: 100, criticalResilience: 100 },
  });
  assert.equal(result.dps?.category, "MAGIC_DPS");
  assert.equal(result.pvp.score, 100);
});
