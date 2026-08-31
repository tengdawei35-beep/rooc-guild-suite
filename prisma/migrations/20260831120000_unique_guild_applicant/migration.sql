-- Keep the most recently updated application for each Discord user in each guild.
DELETE FROM "GuildApplicant" a
USING "GuildApplicant" newer
WHERE a."guildId" = newer."guildId"
  AND a."discordUserId" = newer."discordUserId"
  AND (a."updatedAt", a.id) < (newer."updatedAt", newer.id);

CREATE UNIQUE INDEX IF NOT EXISTS "GuildApplicant_guildId_discordUserId_key"
ON "GuildApplicant" ("guildId", "discordUserId");
