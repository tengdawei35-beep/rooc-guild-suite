import assert from "node:assert/strict";
import test from "node:test";
import { resolveGuildSubscriptionEntitlement, type EntitlementSubscription } from "./entitlement-status-core";

const now = new Date("2026-11-27T00:00:00.000Z");
function subscription(name: string, end: Date | null, cancelAtPeriodEnd = false): EntitlementSubscription {
  return { plan: { name }, currentPeriodEnd: end, cancelAtPeriodEnd };
}

test("active entitlement takes precedence over a later canceled historical row", () => {
  const active = subscription("Complimentary", new Date("2026-12-10T00:00:00.000Z"));
  const canceled = subscription("Stripe Pro", new Date("2027-01-01T00:00:00.000Z"), true);
  const state = resolveGuildSubscriptionEntitlement(active, canceled, now);
  assert.equal(state.enabled, true);
  assert.equal(state.planName, "Complimentary");
  assert.equal(state.expiresAt?.toISOString(), "2026-12-10T00:00:00.000Z");
  assert.equal(state.cancelAtPeriodEnd, false);
});

test("active subscription within seven days warns and rounds remaining days up", () => {
  const active = subscription("Pro", new Date("2026-12-02T12:00:00.000Z"), true);
  const state = resolveGuildSubscriptionEntitlement(active, active, now);
  assert.equal(state.enabled, true);
  assert.equal(state.warning, true);
  assert.equal(state.daysRemaining, 6);
  assert.equal(state.cancelAtPeriodEnd, true);
});

test("active subscription exactly seven days away is inside warning threshold", () => {
  const active = subscription("Pro", new Date(now.getTime() + 7 * 86400000));
  assert.equal(resolveGuildSubscriptionEntitlement(active, active, now).warning, true);
});

test("active subscription more than seven days away does not warn", () => {
  const active = subscription("Pro", new Date(now.getTime() + 8 * 86400000));
  assert.equal(resolveGuildSubscriptionEntitlement(active, active, now).warning, false);
});

test("perpetual active subscription has no expiry warning", () => {
  const active = subscription("Lifetime", null);
  const state = resolveGuildSubscriptionEntitlement(active, active, now);
  assert.equal(state.enabled, true);
  assert.equal(state.expiresAt, null);
  assert.equal(state.daysRemaining, null);
  assert.equal(state.warning, false);
});

test("canceled historical subscription is displayable but grants no entitlement", () => {
  const canceled = subscription("Former Pro", new Date("2026-12-20T00:00:00.000Z"), true);
  const state = resolveGuildSubscriptionEntitlement(null, canceled, now);
  assert.equal(state.enabled, false);
  assert.equal(state.planName, "Former Pro");
  assert.equal(state.warning, false);
  assert.equal(state.cancelAtPeriodEnd, true);
});

test("missing subscription returns a disabled empty state", () => {
  assert.deepEqual(resolveGuildSubscriptionEntitlement(null, null, now), {
    enabled: false,
    expiresAt: null,
    warning: false,
    daysRemaining: null,
    planName: null,
    cancelAtPeriodEnd: false,
  });
});
