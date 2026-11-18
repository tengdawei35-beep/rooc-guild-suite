-- CreateEnum
CREATE TYPE "SaaSModule" AS ENUM ('CORE', 'RESOURCE_SUITE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "Guild" ADD COLUMN     "ownerUserId" TEXT;

-- CreateTable
CREATE TABLE "PlatformGuildCreator" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "maxGuilds" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformGuildCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanModule" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "module" "SaaSModule" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSubscription" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "provider" TEXT,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildModuleEntitlement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "module" "SaaSModule" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildModuleEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformGuildCreator_discordUserId_key" ON "PlatformGuildCreator"("discordUserId");

-- CreateIndex
CREATE INDEX "PlatformGuildCreator_active_idx" ON "PlatformGuildCreator"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE INDEX "PlanModule_module_idx" ON "PlanModule"("module");

-- CreateIndex
CREATE UNIQUE INDEX "PlanModule_planId_module_key" ON "PlanModule"("planId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "GuildSubscription_providerSubscriptionId_key" ON "GuildSubscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "GuildSubscription_guildId_status_idx" ON "GuildSubscription"("guildId", "status");

-- CreateIndex
CREATE INDEX "GuildSubscription_planId_idx" ON "GuildSubscription"("planId");

-- CreateIndex
CREATE INDEX "GuildSubscription_providerCustomerId_idx" ON "GuildSubscription"("providerCustomerId");

-- CreateIndex
CREATE INDEX "GuildModuleEntitlement_module_idx" ON "GuildModuleEntitlement"("module");

-- CreateIndex
CREATE UNIQUE INDEX "GuildModuleEntitlement_guildId_module_key" ON "GuildModuleEntitlement"("guildId", "module");

-- CreateIndex
CREATE INDEX "Guild_ownerUserId_idx" ON "Guild"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Guild" ADD CONSTRAINT "Guild_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanModule" ADD CONSTRAINT "PlanModule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildSubscription" ADD CONSTRAINT "GuildSubscription_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildSubscription" ADD CONSTRAINT "GuildSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildModuleEntitlement" ADD CONSTRAINT "GuildModuleEntitlement_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
