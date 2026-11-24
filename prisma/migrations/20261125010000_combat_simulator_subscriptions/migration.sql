ALTER TYPE "SaaSModule" ADD VALUE IF NOT EXISTS 'COMBAT_SIMULATOR';

CREATE TABLE "UserCombatSimulatorSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "provider" TEXT,
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserCombatSimulatorSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserCombatSimulatorSubscription_providerSubscriptionId_key" ON "UserCombatSimulatorSubscription"("providerSubscriptionId");
CREATE INDEX "UserCombatSimulatorSubscription_userId_status_idx" ON "UserCombatSimulatorSubscription"("userId", "status");
CREATE INDEX "UserCombatSimulatorSubscription_providerCustomerId_idx" ON "UserCombatSimulatorSubscription"("providerCustomerId");
ALTER TABLE "UserCombatSimulatorSubscription" ADD CONSTRAINT "UserCombatSimulatorSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuildCombatSimulatorSubscription" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "provider" TEXT,
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildCombatSimulatorSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuildCombatSimulatorSubscription_providerSubscriptionId_key" ON "GuildCombatSimulatorSubscription"("providerSubscriptionId");
CREATE INDEX "GuildCombatSimulatorSubscription_guildId_status_idx" ON "GuildCombatSimulatorSubscription"("guildId", "status");
CREATE INDEX "GuildCombatSimulatorSubscription_providerCustomerId_idx" ON "GuildCombatSimulatorSubscription"("providerCustomerId");
ALTER TABLE "GuildCombatSimulatorSubscription" ADD CONSTRAINT "GuildCombatSimulatorSubscription_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
