import "dotenv/config";
import Stripe from "stripe";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const basicPriceId = process.env.BASIC_PRICE_ID;
const totalPriceId = process.env.TOTAL_PRICE_ID;

if (!connectionString || !stripeSecretKey || !basicPriceId || !totalPriceId) {
  throw new Error("DATABASE_URL, STRIPE_SECRET_KEY, BASIC_PRICE_ID and TOTAL_PRICE_ID are required to seed plans.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const stripe = new Stripe(stripeSecretKey);

async function upsertPlan(name: string, priceId: string, description: string, modules: ("CORE" | "RESOURCE_SUITE")[]) {
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active || !price.recurring) throw new Error(`${name} Stripe price must be active and recurring.`);
  const interval = price.recurring.interval === "year" ? "YEAR" : "MONTH";
  const plan = await prisma.plan.upsert({
    where: { name },
    create: { name, description, priceCents: price.unit_amount ?? 0, currency: price.currency, billingInterval: interval, active: true },
    update: { description, priceCents: price.unit_amount ?? 0, currency: price.currency, billingInterval: interval, active: true },
  });
  await prisma.planModule.deleteMany({ where: { planId: plan.id } });
  if (modules.length) await prisma.planModule.createMany({ data: modules.map((module) => ({ planId: plan.id, module })), skipDuplicates: true });
  return plan;
}

try {
  const basic = await upsertPlan("Basic", basicPriceId, "Basic Guild Suite subscription", ["CORE"]);
  const total = await upsertPlan("Total", totalPriceId, "Total Guild Suite subscription", ["CORE", "RESOURCE_SUITE"]);
  console.log(`Seeded plans: ${basic.name} (${basic.id}), ${total.name} (${total.id})`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
