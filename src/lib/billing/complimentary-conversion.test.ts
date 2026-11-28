import assert from "node:assert/strict";
import test from "node:test";
import { canStartPaidGuildCheckout, shouldSupersedeComplimentaryAccess } from "./complimentary-conversion";

test("allows paid checkout when the only active subscription is complimentary", () => {
  assert.equal(canStartPaidGuildCheckout([{ provider: "complimentary" }]), true);
});

test("allows paid checkout when there is no active subscription", () => {
  assert.equal(canStartPaidGuildCheckout([]), true);
});

test("blocks checkout when a paid subscription is already active", () => {
  assert.equal(canStartPaidGuildCheckout([{ provider: "stripe" }]), false);
});

test("blocks checkout when complimentary and paid subscriptions overlap", () => {
  assert.equal(canStartPaidGuildCheckout([{ provider: "complimentary" }, { provider: "stripe" }]), false);
});

test("only active or trialing paid subscriptions supersede complimentary access", () => {
  assert.equal(shouldSupersedeComplimentaryAccess("ACTIVE"), true);
  assert.equal(shouldSupersedeComplimentaryAccess("TRIALING"), true);
  assert.equal(shouldSupersedeComplimentaryAccess("INCOMPLETE"), false);
  assert.equal(shouldSupersedeComplimentaryAccess("PAST_DUE"), false);
  assert.equal(shouldSupersedeComplimentaryAccess("CANCELED"), false);
});
