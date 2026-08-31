export type CheckoutRequest = {
  guildId?: string;
  planId: string;
  stripePriceId: string;
  billingTerm?: "monthly" | "quarterly" | "semiannual" | "annual";
  customer: {
    discordUserId: string;
    username: string;
  };
  onboarding?: {
    guildName: string;
    discordGuildId: string;
  };
  affiliate?: {
    id: string;
    code: string;
    discountPercent: number;
  };
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { id: string; url: string };

export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  getSubscription(subscriptionId: string): Promise<unknown>;
  createCustomerPortal(customerId: string, returnUrl: string): Promise<{ url: string }>;
  verifyWebhook(payload: string, signature: string): Promise<unknown>;
}
