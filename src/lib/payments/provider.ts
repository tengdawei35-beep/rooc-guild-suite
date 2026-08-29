export type CheckoutRequest = {
  guildId?: string;
  planId: string;
  stripePriceId: string;
  customer: {
    discordUserId: string;
    username: string;
  };
  onboarding?: {
    guildName: string;
    discordGuildId: string;
  };
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  id: string;
  url: string;
};

export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(payload: string, signature: string): Promise<unknown>;
}
