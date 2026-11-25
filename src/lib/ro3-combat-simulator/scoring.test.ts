import assert from "node:assert/strict";
import testCase from "node:test";
import {
  calculateRo3MemberScores,
  calculateRo3PvPScore,
  calculateRo3Score,
  isRo3DpsJob,
  isRo3TankOrSupportJob,
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
  assert.equal(result.score, 74.09);
  assert.equal(result.contributions.hp, 5);
  assert.ok(Math.abs((result.contributions.defence ?? 0) - 25.9090909091) < 0.001);
  assert.ok(Math.abs((result.contributions.damageReduction ?? 0) - 43.1818181818) < 0.001);
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

testCase("A hybrid job can be explicitly scored as Tank for PvP", () => {
  const result = calculateRo3PvPScore("Royal Guard", 80, 60, "TANK");
  assert.equal(result.score, 60);
  assert.deepEqual(result.weights, { tank: 100 });
});

testCase("Split Royal Guard and Rune Knight jobs resolve to their selected roles", () => {
  assert.equal(isRo3DpsJob("Royal Guard (DPS)"), true);
  assert.equal(isRo3DpsJob("Rune Knight (DPS)"), true);
  assert.equal(isRo3TankOrSupportJob("Royal Guard (Tank)"), true);
  assert.equal(isRo3TankOrSupportJob("Rune Knight (Tank)"), true);
  assert.equal(isRo3TankOrSupportJob("Archbishop"), true);
  assert.equal(isRo3TankOrSupportJob("Royal Guard (DPS)"), false);
});

testCase("Tank-labelled hybrid jobs use Tank-only PvP composition by default", () => {
  const result = calculateRo3PvPScore("Royal Guard (Tank)", 90, 70);
  assert.equal(result.score, 70);
  assert.deepEqual(result.weights, { tank: 100 });
});

testCase("Tank-labelled hybrid member does not receive a DPS score", () => {
  const result = calculateRo3MemberScores({
    job: "Rune Knight (Tank)",
    dpsComponents: { attackPower: 100, penetration: 100, damageAmplification: 100, targetBonuses: 100 },
    tankComponents: { hp: 100, defence: 100, damageReduction: 100, pvpSurvivability: 100, criticalResilience: 100 },
  });
  assert.equal(result.dps, null);
  assert.equal(result.pvp.score, 100);
  assert.deepEqual(result.pvpComposition, { dpsWeight: 0, tankWeight: 100 });
});

testCase("DPS-labelled hybrid jobs retain DPS plus Tank PvP composition", () => {
  const result = calculateRo3PvPScore("Royal Guard (DPS)", 80, 50);
  assert.equal(result.score, 68);
  assert.deepEqual(result.weights, { dps: 60, tank: 40 });
});

testCase("Explicit split job labels take precedence over legacy role overrides", () => {
  const tank = calculateRo3PvPScore("Rune Knight (Tank)", 95, 60, "DPS");
  const dps = calculateRo3PvPScore("Rune Knight (DPS)", 80, 50, "TANK");
  assert.equal(tank.score, 60);
  assert.deepEqual(tank.weights, { tank: 100 });
  assert.equal(dps.score, 68);
  assert.deepEqual(dps.weights, { dps: 60, tank: 40 });
});
