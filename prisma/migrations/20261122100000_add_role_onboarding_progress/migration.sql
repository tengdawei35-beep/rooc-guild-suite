CREATE TABLE "GuildRoleOnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "completedStepIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuildRoleOnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildRoleOnboardingProgress_userId_guildId_key"
ON "GuildRoleOnboardingProgress"("userId", "guildId");

CREATE INDEX "GuildRoleOnboardingProgress_guildId_idx"
ON "GuildRoleOnboardingProgress"("guildId");

ALTER TABLE "GuildRoleOnboardingProgress"
ADD CONSTRAINT "GuildRoleOnboardingProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuildRoleOnboardingProgress"
ADD CONSTRAINT "GuildRoleOnboardingProgress_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
