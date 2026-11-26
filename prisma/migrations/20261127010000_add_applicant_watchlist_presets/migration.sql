CREATE TABLE "GuildApplicantWatchlistEntry" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "characterName" TEXT NOT NULL,
  "normalizedCharacterName" TEXT NOT NULL,
  "watchlist" "ApplicantWatchlist" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildApplicantWatchlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuildApplicantWatchlistEntry_guildId_normalizedCharacterName_key"
  ON "GuildApplicantWatchlistEntry"("guildId", "normalizedCharacterName");
CREATE INDEX "GuildApplicantWatchlistEntry_guildId_watchlist_idx"
  ON "GuildApplicantWatchlistEntry"("guildId", "watchlist");
ALTER TABLE "GuildApplicantWatchlistEntry"
  ADD CONSTRAINT "GuildApplicantWatchlistEntry_guildId_fkey"
  FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
