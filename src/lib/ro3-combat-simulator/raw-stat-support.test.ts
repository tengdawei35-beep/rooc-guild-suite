import assert from "node:assert/strict";
import testCase from "node:test";
import { RO3_STAT_KEYS } from "../constants/ro3-stats";
import {
  getRo3RawStatSupport,
  isRo3RawStatEligibleForDamageCalibration,
} from "./raw-stat-support";

testCase("Every persisted RO3 stat has an explicit support classification", () => {
  for (const key of RO3_STAT_KEYS) {
    assert.ok(getRo3RawStatSupport(key).status, `Missing support classification: ${key}`);
  }
});

testCase("Simulator-supported attack and damage modifiers are eligible for damage calibration", () => {
  assert.equal(isRo3RawStatEligibleForDamageCalibration("patk"), true);
  assert.equal(isRo3RawStatEligibleForDamageCalibration("matk"), true);
  assert.equal(isRo3RawStatEligibleForDamageCalibration("physicalDamageBonusPercent"), true);
  assert.equal(isRo3RawStatEligibleForDamageCalibration("magicDamageBonusPercent"), true);
  assert.equal(isRo3RawStatEligibleForDamageCalibration("damageIncreasePercent"), true);
  assert.equal(isRo3RawStatEligibleForDamageCalibration("critDamagePercent"), true);
  assert.equal(isRo3RawStatEligibleForDamageCalibration("physicalPenetrationPercent"), false);
  assert.equal(isRo3RawStatEligibleForDamageCalibration("damageReductionPercent"), false);
});

testCase("Defensive stats are not mistaken for a validated incoming-damage model", () => {
  assert.equal(getRo3RawStatSupport("pdef").use, "defensive-context");
  assert.equal(getRo3RawStatSupport("mdef").use, "defensive-context");
  assert.equal(getRo3RawStatSupport("hp").use, "defensive-context");
});
