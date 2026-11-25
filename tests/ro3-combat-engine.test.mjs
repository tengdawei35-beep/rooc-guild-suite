import test from "node:test";
import assert from "node:assert/strict";
import {
  Ro3DataStore,
  computeStatSheet,
  statCost,
  totalStatPoints,
} from "../src/lib/ro3-combat-simulator/engine/ro3-damage-engine.mjs";

test("extracted engine exposes fallback data without browser globals", () => {
  const data = new Ro3DataStore();
  assert.ok(data.row("AttributeConfig", 103));
  assert.ok(data.row("JobConfig", 1100));
});

test("stat point calculations retain fallback table behaviour", () => {
  const data = new Ro3DataStore();
  assert.equal(statCost(10, data), 18);
  assert.equal(totalStatPoints(1, 0, data), 48);
});

test("attribute pipeline applies the same base-percent calculation", () => {
  const data = new Ro3DataStore();
  const sheet = computeStatSheet({ 1: 10, 11: 5000 }, data);
  assert.equal(sheet[1], 15);
  assert.equal(sheet.base[1], 10);
});
