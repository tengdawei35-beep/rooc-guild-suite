ALTER TABLE "GuildMember"
ADD COLUMN "discordUserId" TEXT,
ADD COLUMN "discordUsername" TEXT;

CREATE INDEX "GuildMember_discordUserId_idx"
ON "GuildMember"("discordUserId");

CREATE INDEX "GuildMember_discordUsername_idx"
ON "GuildMember"("discordUsername");

CREATE UNIQUE INDEX "GuildMember_guildId_discordUserId_key"
ON "GuildMember"("guildId", "discordUserId");
