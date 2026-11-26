import test from "node:test";
import assert from "node:assert/strict";
import { Ro3DataStore, simulateDistribution } from "../src/lib/ro3-combat-simulator/engine/ro3-damage-engine.mjs";

test("legacy Monte Carlo distribution is deterministic for a fixed seed", () => {
  const data = new Ro3DataStore();
  const build = { career: 1410, level: 100, stats: [80, 60, 50, 20, 80, 20], element: 4, bondBonusBp: 12500 };
  const defender = { level: 100, def: 500, mdef: 500, element: 1, race: 1, size: 2 };
  const options = { runs: 200, seed: 123456, bins: 72, bucketMs: 1000, captureRun: true };
  const first = simulateDistribution(build, defender, [], 5000, options, data);
  const second = simulateDistribution(build, defender, [], 5000, options, data);
  assert.equal(first.runs, 200);
  assert.equal(first.durationMs, 5000);
  assert.equal(first.totals.length, 200);
  assert.ok(first.expectedTotal > 0);
  assert.ok(first.deterministic.castLog.length > 0);
  assert.ok(first.sampleRun?.length);
  for (const skill of first.skills) {
    assert.ok(skill.normalBins instanceof Uint32Array);
    assert.ok(skill.critBins instanceof Uint32Array);
    assert.equal(Array.from(skill.normalBins).reduce((sum, count) => sum + count, 0), skill.hits);
    assert.equal(Array.from(skill.critBins).reduce((sum, count) => sum + count, 0), skill.crits);
  }
  assert.deepEqual(Array.from(first.totals), Array.from(second.totals));
  assert.deepEqual(first.skills.map((skill) => [skill.id, skill.total, skill.hits, skill.crits, skill.misses]), second.skills.map((skill) => [skill.id, skill.total, skill.hits, skill.crits, skill.misses]));
});
