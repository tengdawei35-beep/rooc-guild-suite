import Stripe from "stripe";
import type { CheckoutRequest, CheckoutSession, PaymentProvider } from "./provider";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(secretKey);
}

function getLaunchDiscount(): Stripe.Checkout.SessionCreateParams.Discount | null {
  const promotionCode = process.env.STRIPE_LAUNCH_PROMOTION_CODE_ID;
  if (promotionCode) return { promotion_code: promotionCode };
  const coupon = process.env.STRIPE_LAUNCH_COUPON_ID ?? process.env.STRIPE_COUPON_ID;
  return coupon ? { coupon } : null;
}

function getAffiliateDiscount(request: CheckoutRequest): Stripe.Checkout.SessionCreateParams.Discount | null {
  const coupon = process.env.STRIPE_AFFILIATE_COUPON_ID;
  if (!request.affiliate || !coupon) return null;
  return { coupon };
}

export class StripePaymentProvider implements PaymentProvider {
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> { return getStripe().subscriptions.retrieve(subscriptionId); }
  async createCustomerPortal(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return { url: session.url };
  }
  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const stripe = getStripe();
    const metadata: Record<string, string> = { planId: request.planId, discordUserId: request.customer.discordUserId, billingTerm: request.billingTerm ?? "monthly" };
    if (request.guildId) metadata.guildId = request.guildId;
    if (request.onboarding) { metadata.guildName = request.onboarding.guildName; metadata.discordGuildId = request.onboarding.discordGuildId; }
    if (request.affiliate) { metadata.affiliateId = request.affiliate.id; metadata.affiliateCode = request.affiliate.code; metadata.affiliateDiscountPercent = String(request.affiliate.discountPercent); }

    const affiliateDiscount = getAffiliateDiscount(request);
    const launchDiscount = request.billingTerm === "monthly" ? getLaunchDiscount() : null;
    const discounts = affiliateDiscount ?? launchDiscount;
    if (request.billingTerm === "monthly" && !discounts) throw new Error("STRIPE_LAUNCH_COUPON_ID or STRIPE_LAUNCH_PROMOTION_CODE_ID is not configured.");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription", line_items: [{ price: request.stripePriceId, quantity: 1 }], success_url: request.successUrl, cancel_url: request.cancelUrl,
      client_reference_id: request.guildId ?? request.customer.discordUserId, metadata, subscription_data: { metadata },
      ...(discounts ? { discounts: [discounts] } : {}),
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { id: session.id, url: session.url };
  }
  async verifyWebhook(payload: string, signature: string): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
export const stripePaymentProvider = new StripePaymentProvider();
