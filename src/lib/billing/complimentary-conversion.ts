export type ActiveGuildSubscription = { provider: string | null };

/** Complimentary access may coexist with a pending paid checkout, but an existing paid subscription may not. */
export function canStartPaidGuildCheckout(subscriptions: ActiveGuildSubscription[]): boolean {
  return subscriptions.every((subscription) => subscription.provider === "complimentary");
}

/** Only a confirmed Stripe entitlement may supersede a complimentary grant. */
export function shouldSupersedeComplimentaryAccess(status: string): boolean {
  return status === "ACTIVE" || status === "TRIALING";
}
