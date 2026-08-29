import Stripe from "stripe";

import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
} from "./provider";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(secretKey);
}

export class StripePaymentProvider implements PaymentProvider {
  async createCheckout(
    request: CheckoutRequest,
  ): Promise<CheckoutSession> {
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{
        price: request.planId,
        quantity: 1,
      }],
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      client_reference_id: request.guildId,
      metadata: {
        guildId: request.guildId,
        planId: request.planId,
        discordUserId: request.customer.discordUserId,
      },
      subscription_data: {
        metadata: {
          guildId: request.guildId,
          planId: request.planId,
          discordUserId: request.customer.discordUserId,
        },
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return {
      id: session.id,
      url: session.url,
    };
  }

  async verifyWebhook(
    payload: string,
    signature: string,
  ): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    }

    return getStripe().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }
}

export const stripePaymentProvider =
  new StripePaymentProvider();
