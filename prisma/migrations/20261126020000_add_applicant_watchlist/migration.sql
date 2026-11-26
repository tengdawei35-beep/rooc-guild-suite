CREATE TYPE "ApplicantWatchlist" AS ENUM ('GREEN', 'YELLOW', 'RED');
ALTER TABLE "GuildApplicant" ADD COLUMN "watchlist" "ApplicantWatchlist";
