ALTER TABLE "RotationRecovery"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "RotationRecovery_sourceRunId_idx"
ON "RotationRecovery"("sourceRunId");
