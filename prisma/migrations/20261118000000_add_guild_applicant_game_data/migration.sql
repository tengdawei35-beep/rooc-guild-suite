-- Additive game-specific applicant payload storage. Existing applicant data remains unchanged.
CREATE TABLE "GuildApplicantGameData" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "payload" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuildApplicantGameData_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildApplicantGameData_applicantId_key" ON "GuildApplicantGameData"("applicantId");
CREATE INDEX "GuildApplicantGameData_gameType_idx" ON "GuildApplicantGameData"("gameType");

ALTER TABLE "GuildApplicantGameData"
ADD CONSTRAINT "GuildApplicantGameData_applicantId_fkey"
FOREIGN KEY ("applicantId") REFERENCES "GuildApplicant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
