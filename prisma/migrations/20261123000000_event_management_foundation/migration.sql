ALTER TABLE "Guild" ADD COLUMN "timeZone" TEXT;

CREATE TYPE "EventAttendanceStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'AFK_BUSY');

CREATE TABLE "GuildEventType" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "battlefieldCount" INTEGER NOT NULL DEFAULT 2,
  "partiesPerBattlefield" INTEGER NOT NULL DEFAULT 4,
  "weekdays" INTEGER[] NOT NULL,
  "startTime" TEXT NOT NULL DEFAULT '20:00',
  "timeZone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildEventType_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Event"
  ADD COLUMN "guildEventTypeId" TEXT,
  ADD COLUMN "eventTypeName" TEXT,
  ADD COLUMN "battlefieldCount" INTEGER,
  ADD COLUMN "partiesPerBattlefield" INTEGER,
  ADD COLUMN "scheduleTimeZone" TEXT;

ALTER TABLE "Ro3EventType" ADD COLUMN "guildEventTypeId" TEXT;

INSERT INTO "GuildEventType" ("id", "guildId", "name", "active", "battlefieldCount", "partiesPerBattlefield", "weekdays", "startTime", "timeZone", "createdAt", "updatedAt")
SELECT 'get_' || md5(x."guildId" || ':' || x."name"), x."guildId", x."name", bool_or(x."active"), 2, 4, ARRAY[]::INTEGER[], '20:00', COALESCE(g."timeZone", 'UTC'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Ro3EventType" x
JOIN "Guild" g ON g."id" = x."guildId"
GROUP BY x."guildId", x."name", g."timeZone";

UPDATE "Ro3EventType" r
SET "guildEventTypeId" = t."id"
FROM "GuildEventType" t
WHERE t."guildId" = r."guildId" AND t."name" = r."name";

UPDATE "Event" e
SET "guildEventTypeId" = r."guildEventTypeId",
    "eventTypeName" = r."name",
    "battlefieldCount" = 2,
    "partiesPerBattlefield" = 4,
    "scheduleTimeZone" = COALESCE(g."timeZone", 'UTC')
FROM "Ro3EventType" r
JOIN "Guild" g ON g."id" = r."guildId"
WHERE e."ro3EventTypeId" = r."id";

CREATE TABLE "EventAttendance" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "EventAttendanceStatus" NOT NULL,
  "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventResultImage" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventResultImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildEventType_guildId_name_key" ON "GuildEventType"("guildId", "name");
CREATE INDEX "GuildEventType_guildId_active_idx" ON "GuildEventType"("guildId", "active");
CREATE INDEX "Event_guildEventTypeId_idx" ON "Event"("guildEventTypeId");
CREATE INDEX "EventAttendance_eventId_status_idx" ON "EventAttendance"("eventId", "status");
CREATE INDEX "EventAttendance_memberId_idx" ON "EventAttendance"("memberId");
CREATE UNIQUE INDEX "EventAttendance_eventId_memberId_key" ON "EventAttendance"("eventId", "memberId");
CREATE UNIQUE INDEX "EventResultImage_storagePath_key" ON "EventResultImage"("storagePath");
CREATE INDEX "EventResultImage_guildId_createdAt_idx" ON "EventResultImage"("guildId", "createdAt");
CREATE INDEX "EventResultImage_eventId_idx" ON "EventResultImage"("eventId");

ALTER TABLE "GuildEventType" ADD CONSTRAINT "GuildEventType_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_guildEventTypeId_fkey" FOREIGN KEY ("guildEventTypeId") REFERENCES "GuildEventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ro3EventType" ADD CONSTRAINT "Ro3EventType_guildEventTypeId_fkey" FOREIGN KEY ("guildEventTypeId") REFERENCES "GuildEventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventResultImage" ADD CONSTRAINT "EventResultImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventResultImage" ADD CONSTRAINT "EventResultImage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
