CREATE TABLE "GuildMemberGameData" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "gameType" "GameType" NOT NULL,
  "payload" JSONB NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildMemberGameData_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuildMemberGameData_memberId_key" ON "GuildMemberGameData"("memberId");
CREATE INDEX "GuildMemberGameData_gameType_idx" ON "GuildMemberGameData"("gameType");
ALTER TABLE "GuildMemberGameData" ADD CONSTRAINT "GuildMemberGameData_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
