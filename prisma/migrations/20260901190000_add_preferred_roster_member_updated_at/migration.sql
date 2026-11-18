-- Add the timestamp column now required by the Prisma schema.
ALTER TABLE "PreferredRosterMember"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
