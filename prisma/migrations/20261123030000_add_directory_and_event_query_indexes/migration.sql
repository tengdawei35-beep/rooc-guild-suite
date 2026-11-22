-- Build indexes without blocking normal reads and writes on the indexed tables.
-- The corresponding @@index declarations live in prisma/schema.prisma.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GuildMember_guildId_characterName_id_idx"
  ON "GuildMember" ("guildId", "characterName", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GuildMember_guildId_active_characterName_id_idx"
  ON "GuildMember" ("guildId", "active", "characterName", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GuildMember_guildId_job_characterName_id_idx"
  ON "GuildMember" ("guildId", "job", "characterName", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GuildMember_guildId_active_eligible_idx"
  ON "GuildMember" ("guildId", "active", "eligible");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Event_guildId_date_createdAt_id_idx"
  ON "Event" ("guildId", "date" DESC, "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Event_guildId_date_id_idx"
  ON "Event" ("guildId", "date" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "EventResultImage_eventId_createdAt_id_idx"
  ON "EventResultImage" ("eventId", "createdAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GuildSubscription_guildId_createdAt_id_idx"
  ON "GuildSubscription" ("guildId", "createdAt" DESC, "id" DESC);
