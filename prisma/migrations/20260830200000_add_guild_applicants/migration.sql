CREATE TYPE "ApplicantStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DENIED');

CREATE TABLE "ApplicantInvite" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ApplicantInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicantInvite_token_key" ON "ApplicantInvite"("token");
CREATE INDEX "ApplicantInvite_guildId_active_idx" ON "ApplicantInvite"("guildId", "active");
CREATE INDEX "ApplicantInvite_createdByUserId_idx" ON "ApplicantInvite"("createdByUserId");

CREATE TABLE "GuildApplicant" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "inviteId" TEXT NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "discordUsername" TEXT NOT NULL,
  "userId" TEXT,
  "characterName" TEXT NOT NULL,
  "job" TEXT,
  "status" "ApplicantStatus" NOT NULL DEFAULT 'PENDING',
  "remarks" TEXT,
  "pdef" DOUBLE PRECISION,
  "mdef" DOUBLE PRECISION,
  "pvpDamageBonus" DOUBLE PRECISION,
  "pvpDamageReduction" DOUBLE PRECISION,
  "pdmgPercent" DOUBLE PRECISION,
  "mdmgPercent" DOUBLE PRECISION,
  "pdmgReductionPercent" DOUBLE PRECISION,
  "mdmgReductionPercent" DOUBLE PRECISION,
  "critRes" DOUBLE PRECISION,
  "ignorePdef" DOUBLE PRECISION,
  "ignoreMdef" DOUBLE PRECISION,
  "damageVsMedium" DOUBLE PRECISION,
  "damageReductionVsMedium" DOUBLE PRECISION,
  "damageVsSmall" DOUBLE PRECISION,
  "damageReductionVsSmall" DOUBLE PRECISION,
  "damageVsDemiHuman" DOUBLE PRECISION,
  "damageReductionVsDemiHuman" DOUBLE PRECISION,
  "damageVsBrute" DOUBLE PRECISION,
  "damageReductionVsBrute" DOUBLE PRECISION,
  "equipmentPdefPercent" DOUBLE PRECISION,
  "equipmentMdefPercent" DOUBLE PRECISION,
  "patk" DOUBLE PRECISION,
  "matk" DOUBLE PRECISION,
  "hp" DOUBLE PRECISION,
  "dpsScore" DOUBLE PRECISION,
  "tankScore" DOUBLE PRECISION,
  "pvpScore" DOUBLE PRECISION,
  "dpsPercentile" DOUBLE PRECISION,
  "tankPercentile" DOUBLE PRECISION,
  "pvpPercentile" DOUBLE PRECISION,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuildApplicant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuildApplicant_guildId_status_idx" ON "GuildApplicant"("guildId", "status");
CREATE INDEX "GuildApplicant_guildId_discordUserId_idx" ON "GuildApplicant"("guildId", "discordUserId");
CREATE INDEX "GuildApplicant_inviteId_idx" ON "GuildApplicant"("inviteId");
