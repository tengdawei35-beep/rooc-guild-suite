export type EntitlementSubscription = {
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  plan: { name: string };
};

export type GuildEntitlementState = {
  enabled: boolean;
  expiresAt: Date | null;
  warning: boolean;
  daysRemaining: number | null;
  planName: string | null;
  cancelAtPeriodEnd: boolean;
};

/** Pure resolver shared by billing UI logic and regression tests. */
export function resolveGuildSubscriptionEntitlement(
  activeSubscription: EntitlementSubscription | null,
  latestSubscription: EntitlementSubscription | null,
  now: Date = new Date(),
): GuildEntitlementState {
  // Prefer current entitlement over a newer canceled historical record.
  const subscription = activeSubscription ?? latestSubscription;
  const expiresAt = subscription?.currentPeriodEnd ?? null;
  const enabled = activeSubscription !== null;

  if (!subscription || !expiresAt) {
    return {
      enabled,
      expiresAt,
      warning: false,
      daysRemaining: null,
      planName: subscription?.plan.name ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    };
  }

  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / 86400000);
  return {
    enabled: enabled && msRemaining > 0,
    expiresAt,
    warning: enabled && msRemaining > 0 && msRemaining <= 7 * 86400000,
    daysRemaining,
    planName: subscription.plan.name,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}
