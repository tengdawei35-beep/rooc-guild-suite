-- The live ranking columns were already introduced by
-- 20260831130000_add_live_guild_rankings. Keep this follow-up migration
-- limited to the index so production databases that already have the
-- columns can recover safely.
CREATE INDEX IF NOT EXISTS "GuildMember_guildId_guildRank_idx"
  ON "GuildMember"("guildId", "guildRank");
