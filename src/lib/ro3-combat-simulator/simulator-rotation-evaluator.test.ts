import assert from "node:assert/strict";
import testCase from "node:test";
import { evaluateRo3Rotation } from "./simulator-rotation-evaluator";

testCase("Explicit skill cycle is evaluated by the embedded simulator rotation scheduler", async () => {
  const result = await evaluateRo3Rotation({
    stats: { patk: 10000 },
    careerId: 1100,
    skillIds: [1100110, 1100210, 999999999],
    durationMs: 20000,
  });
  assert.match(result.engineSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.referenceLevel, 99);
  assert.deepEqual(result.rotationSkillIds, [1100110, 1100210]);
  assert.equal(result.skippedSkills.length, 1);
  assert.ok(result.sustainedDps > 0);
  assert.ok(result.totalExpectedDamage > 0);
  assert.equal(result.score, null);
});

testCase("Rotation evaluator rejects missing career IDs and invalid durations", async () => {
  await assert.rejects(() => evaluateRo3Rotation({
    stats: { patk: 10000 }, careerId: 0, skillIds: [1100110],
  }), /careerId/);
  await assert.rejects(() => evaluateRo3Rotation({
    stats: { patk: 10000 }, careerId: 1100, skillIds: [1100110], durationMs: 1000,
  }), /duration/);
});

testCase("Rotation evaluator requires at least one valid damage skill", async () => {
  await assert.rejects(() => evaluateRo3Rotation({
    stats: { patk: 10000 }, careerId: 1100, skillIds: [999999999],
  }), /damage skill/);
});
