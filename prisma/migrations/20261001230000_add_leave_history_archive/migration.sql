-- Preserve leave records when a guild member is permanently deleted.
CREATE TABLE "LeaveHistory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "originalMemberId" TEXT,
    "discordUserId" TEXT,
    "discordUsername" TEXT,
    "characterName" TEXT,
    "job" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeaveHistory_guildId_idx" ON "LeaveHistory"("guildId");
CREATE INDEX "LeaveHistory_discordUserId_idx" ON "LeaveHistory"("discordUserId");
CREATE INDEX "LeaveHistory_date_idx" ON "LeaveHistory"("date");
CREATE INDEX "LeaveHistory_guildId_date_idx" ON "LeaveHistory"("guildId", "date");
ALTER TABLE "LeaveHistory" ADD CONSTRAINT "LeaveHistory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
