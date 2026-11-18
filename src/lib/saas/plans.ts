import { prisma } from "@/lib/prisma";
import type { SaaSModule } from "@/generated/prisma/client";

export const BASIC_PLAN = "BASIC";
export const TOTAL_PLAN = "TOTAL";

export const PLAN_CATALOG = {
  [BASIC_PLAN]: {
    name: "Basic",
    description: "Core guild management without the Resource Suite.",
    priceCents: 0,
    currency: "usd",
    modules: ["CORE"] as SaaSModule[],
  },
  [TOTAL_PLAN]: {
    name: "Total",
    description: "Core guild management plus Resources, Bidding, and Allocation.",
    priceCents: 0,
    currency: "usd",
    modules: ["CORE", "RESOURCE_SUITE"] as SaaSModule[],
  },
} as const;

export async function getActivePlans() {
  return prisma.plan.findMany({
    where: { active: true },
    orderBy: { priceCents: "asc" },
    include: { modules: true },
  });
}

export async function getPlanByName(name: string) {
  return prisma.plan.findFirst({
    where: { name, active: true },
    include: { modules: true },
  });
}

export async function syncPlanCatalog() {
  for (const catalogPlan of Object.values(PLAN_CATALOG)) {
    const plan = await prisma.plan.upsert({
      where: { name: catalogPlan.name },
      create: {
        name: catalogPlan.name,
        description: catalogPlan.description,
        priceCents: catalogPlan.priceCents,
        currency: catalogPlan.currency,
        active: true,
      },
      update: {
        description: catalogPlan.description,
        priceCents: catalogPlan.priceCents,
        currency: catalogPlan.currency,
        active: true,
      },
    });

    await prisma.planModule.deleteMany({ where: { planId: plan.id } });
    await prisma.planModule.createMany({
      data: catalogPlan.modules.map((module) => ({
        planId: plan.id,
        module,
      })),
    });
  }
}
