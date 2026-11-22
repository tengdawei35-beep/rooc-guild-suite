CREATE TABLE "AdminImpersonationSession" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "mode" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "endedReason" TEXT,
  CONSTRAINT "AdminImpersonationSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AdminImpersonationAuditLog" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminImpersonationAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminImpersonationSession_adminUserId_startedAt_idx" ON "AdminImpersonationSession"("adminUserId", "startedAt");
CREATE INDEX "AdminImpersonationSession_guildId_startedAt_idx" ON "AdminImpersonationSession"("guildId", "startedAt");
CREATE INDEX "AdminImpersonationSession_expiresAt_endedAt_idx" ON "AdminImpersonationSession"("expiresAt", "endedAt");
CREATE INDEX "AdminImpersonationAuditLog_sessionId_createdAt_idx" ON "AdminImpersonationAuditLog"("sessionId", "createdAt");
CREATE INDEX "AdminImpersonationAuditLog_actorUserId_createdAt_idx" ON "AdminImpersonationAuditLog"("actorUserId", "createdAt");
ALTER TABLE "AdminImpersonationAuditLog" ADD CONSTRAINT "AdminImpersonationAuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdminImpersonationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
