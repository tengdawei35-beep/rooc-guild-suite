CREATE TABLE "GuildOnboardingProgress" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildOnboardingProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuildOnboardingProgress_guildId_key" ON "GuildOnboardingProgress"("guildId");
ALTER TABLE "GuildOnboardingProgress" ADD CONSTRAINT "GuildOnboardingProgress_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
