ALTER TABLE "PreferredRosterMember"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "RosterJobOverride" (
  "id" TEXT NOT NULL,
  "rosterMemberId" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RosterJobOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RosterJobOverride_rosterMemberId_key" UNIQUE ("rosterMemberId"),
  CONSTRAINT "RosterJobOverride_rosterMemberId_fkey" FOREIGN KEY ("rosterMemberId") REFERENCES "RosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RosterJobOverride_job_idx" ON "RosterJobOverride"("job");

CREATE TABLE "PreferredRosterJobOverride" (
  "id" TEXT NOT NULL,
  "preferredRosterMemberId" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreferredRosterJobOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PreferredRosterJobOverride_preferredRosterMemberId_key" UNIQUE ("preferredRosterMemberId"),
  CONSTRAINT "PreferredRosterJobOverride_preferredRosterMemberId_fkey" FOREIGN KEY ("preferredRosterMemberId") REFERENCES "PreferredRosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PreferredRosterJobOverride_job_idx" ON "PreferredRosterJobOverride"("job");
