-- Add game type to guilds. Existing guilds remain ROO Classic by default.
CREATE TYPE "GameType" AS ENUM ('ROOC', 'RO3');

ALTER TABLE "Guild"
ADD COLUMN "gameType" "GameType" NOT NULL DEFAULT 'ROOC';
