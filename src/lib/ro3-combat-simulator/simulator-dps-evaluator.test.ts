import assert from "node:assert/strict";
import testCase from "node:test";
import { evaluateRo3DpsProfile } from "./simulator-dps-evaluator";

testCase("Physical and magic member skill outputs use the embedded simulator engine", async () => {
  const result = await evaluateRo3DpsProfile({
    stats: { patk: 10000, matk: 10000 },
    skillIds: [1100101, 1200401],
  });

  assert.match(result.engineSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.referenceLevel, 99);
  assert.equal(result.skills.length, 2);
  assert.equal(result.skills[0].channel, "PHYSICAL");
  assert.equal(result.skills[1].channel, "MAGIC");
  assert.ok(result.skills.every((skill) => skill.expectedDamagePerCast > 0));
  assert.equal(result.score, null);
});

testCase("Increasing the persisted attack stat increases the corresponding simulator output", async () => {
  const [physicalBase, physicalHigher, magicBase, magicHigher] = await Promise.all([
    evaluateRo3DpsProfile({ stats: { patk: 10000, matk: 10000 }, skillIds: [1100101] }),
    evaluateRo3DpsProfile({ stats: { patk: 11000, matk: 10000 }, skillIds: [1100101] }),
    evaluateRo3DpsProfile({ stats: { patk: 10000, matk: 10000 }, skillIds: [1200401] }),
    evaluateRo3DpsProfile({ stats: { patk: 10000, matk: 11000 }, skillIds: [1200401] }),
  ]);
  assert.ok(physicalHigher.skills[0].expectedDamagePerCast > physicalBase.skills[0].expectedDamagePerCast);
  assert.ok(magicHigher.skills[0].expectedDamagePerCast > magicBase.skills[0].expectedDamagePerCast);
});

testCase("Unsupported persisted stats are reported and do not silently become score inputs", async () => {
  const result = await evaluateRo3DpsProfile({
    stats: { patk: 10000, physicalPenetrationPercent: 50, damageReductionPercent: 20 },
    skillIds: [1100101, 999999999],
  });
  assert.equal(result.skills.length, 1);
  assert.equal(result.skippedSkills.length, 1);
  assert.equal(result.excludedPersistedStats.length, 2);
  assert.equal(result.score, null);
});
