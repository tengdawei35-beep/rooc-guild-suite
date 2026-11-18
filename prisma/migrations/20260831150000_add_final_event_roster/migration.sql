-- An event may optionally publish exactly one generated roster to guild members.
-- NULL means the event has no published/final roster yet.
ALTER TABLE "Event"
ADD COLUMN "finalRosterId" TEXT;

CREATE UNIQUE INDEX "Event_finalRosterId_key"
ON "Event"("finalRosterId");

ALTER TABLE "Event"
ADD CONSTRAINT "Event_finalRosterId_fkey"
FOREIGN KEY ("finalRosterId") REFERENCES "Roster"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Event_finalRosterId_idx"
ON "Event"("finalRosterId");
