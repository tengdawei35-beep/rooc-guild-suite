CREATE TABLE "DiscordSubscriptionRoleMapping" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "discordRoleId" TEXT NOT NULL,
  "discordRoleName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordSubscriptionRoleMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordSubscriptionRoleMapping_planId_key" ON "DiscordSubscriptionRoleMapping"("planId");
CREATE UNIQUE INDEX "DiscordSubscriptionRoleMapping_discordRoleId_key" ON "DiscordSubscriptionRoleMapping"("discordRoleId");
CREATE INDEX "DiscordSubscriptionRoleMapping_enabled_idx" ON "DiscordSubscriptionRoleMapping"("enabled");
ALTER TABLE "DiscordSubscriptionRoleMapping" ADD CONSTRAINT "DiscordSubscriptionRoleMapping_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
