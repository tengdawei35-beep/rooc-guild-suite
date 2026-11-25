import assert from "node:assert/strict";
import testCase from "node:test";
import {
  calculateRo3MemberScores,
  calculateRo3Score,
  type Ro3ScoreComponents,
} from "./scoring";

/**
 * Deterministic synthetic fixtures for validating score composition only.
 * Values are already-normalized 0–100 component inputs; they are not raw
 * character stats, simulator outputs, or proposed live-member baselines.
 */
type SyntheticScenario = {
  id: string;
  category: "PHYSICAL_DPS" | "MAGIC_DPS";
  supportsCriticalHits?: boolean;
  components: Ro3ScoreComponents;
};

const scenarios: SyntheticScenario[] = [
  {
    id: "physical-dps-balanced",
    category: "PHYSICAL_DPS" as const,
    components: { attackPower: 72, penetration: 68, damageAmplification: 75, targetBonuses: 60 },
  },
  {
    id: "magic-dps-balanced",
    category: "MAGIC_DPS" as const,
    components: { attackPower: 70, penetration: 65, damageAmplification: 80, targetBonuses: 55 },
  },
  {
    id: "physical-dps-critical",
    category: "PHYSICAL_DPS" as const,
    supportsCriticalHits: true,
    components: { attackPower: 70, penetration: 65, damageAmplification: 75, targetBonuses: 60, criticalOutput: 90 },
  },
];

testCase("Synthetic DPS scenarios are deterministic and bounded", () => {
  for (const scenario of scenarios) {
    const first = calculateRo3Score(scenario.category, scenario.components, {
      supportsCriticalHits: scenario.supportsCriticalHits,
    });
    const second = calculateRo3Score(scenario.category, scenario.components, {
      supportsCriticalHits: scenario.supportsCriticalHits,
    });
    assert.equal(first.score, second.score, scenario.id);
    assert.ok(first.score !== null && first.score >= 0 && first.score <= 100, scenario.id);
  }
});

testCase("Increasing any included DPS component cannot reduce its score", () => {
  for (const scenario of scenarios) {
    const base = calculateRo3Score(scenario.category, scenario.components, {
      supportsCriticalHits: scenario.supportsCriticalHits,
    });
    assert.notEqual(base.score, null, scenario.id);

    for (const key of Object.keys(scenario.components) as (keyof typeof scenario.components)[]) {
      const changed = { ...scenario.components, [key]: 100 };
      const higher = calculateRo3Score(scenario.category, changed, {
        supportsCriticalHits: scenario.supportsCriticalHits,
      });
      assert.ok((higher.score ?? -1) >= (base.score ?? 0), `${scenario.id}: ${String(key)}`);
    }
  }
});

testCase("Changing an omitted or unrelated raw-stat field cannot affect composition", () => {
  const normalized: Ro3ScoreComponents = {
    attackPower: 70,
    penetration: 60,
    damageAmplification: 80,
    targetBonuses: 50,
  };
  const baseline = calculateRo3Score("PHYSICAL_DPS", normalized);
  // Raw-stat keys are intentionally not accepted by the composition API.
  const withUnrelatedRawStats = {
    ...normalized,
    hp: 999999,
    patk: 999999,
    matk: 999999,
    pdef: 999999,
    mdef: 999999,
  } as Ro3ScoreComponents;
  const changed = calculateRo3Score("PHYSICAL_DPS", withUnrelatedRawStats);
  assert.equal(changed.score, baseline.score);
});

testCase("Synthetic Warlock profile routes to Magic DPS and composes PvP deterministically", () => {
  const result = calculateRo3MemberScores({
    job: "Warlock",
    dpsComponents: {
      attackPower: 70,
      penetration: 65,
      damageAmplification: 80,
      targetBonuses: 55,
    },
    tankComponents: {
      hp: 75,
      defence: 70,
      damageReduction: 65,
      pvpSurvivability: 60,
      criticalResilience: 55,
    },
  });
  assert.equal(result.dps?.category, "MAGIC_DPS");
  assert.notEqual(result.dps?.score, null);
  assert.notEqual(result.tank.score, null);
  assert.equal(
    result.pvp.score,
    Math.round(((result.dps!.score! * 0.6 + result.tank.score! * 0.4)) * 100) / 100,
  );
});

testCase("Synthetic incomplete DPS profile reports missing components rather than fabricating them", () => {
  const result = calculateRo3Score("PHYSICAL_DPS", {
    attackPower: 70,
    damageAmplification: 65,
  });
  assert.ok(result.missingComponents.includes("penetration"));
  assert.ok(result.missingComponents.includes("targetBonuses"));
  assert.notEqual(result.score, null);
});
