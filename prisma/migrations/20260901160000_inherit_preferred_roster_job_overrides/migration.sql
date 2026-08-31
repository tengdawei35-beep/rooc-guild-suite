CREATE OR REPLACE FUNCTION inherit_preferred_roster_job_override()
RETURNS TRIGGER AS $$
DECLARE
  preferred_job TEXT;
BEGIN
  SELECT pro.job
  INTO preferred_job
  FROM "RosterParty" rp
  JOIN "Roster" r ON r.id = rp."rosterId"
  JOIN "Event" e ON e.id = r."eventId"
  JOIN "PreferredRoster" pr
    ON pr."guildId" = e."guildId"
   AND pr.type = e.type
  JOIN "PreferredRosterParty" prp
    ON prp."preferredRosterId" = pr.id
   AND prp.battlefield = rp.battlefield
   AND prp."partyNumber" = rp."partyNumber"
  JOIN "PreferredRosterMember" prm
    ON prm."preferredRosterPartyId" = prp.id
   AND prm."memberId" = NEW."memberId"
   AND prm."slotNumber" = NEW."slotNumber"
  JOIN "PreferredRosterJobOverride" pro
    ON pro."preferredRosterMemberId" = prm.id
  WHERE rp.id = NEW."partyId"
  LIMIT 1;

  IF preferred_job IS NOT NULL THEN
    INSERT INTO "RosterJobOverride" ("id", "rosterMemberId", "job")
    VALUES (gen_random_uuid()::text, NEW.id, preferred_job)
    ON CONFLICT ("rosterMemberId")
    DO UPDATE SET "job" = EXCLUDED."job", "updatedAt" = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "RosterMember_inherit_preferred_job_override" ON "RosterMember";
CREATE TRIGGER "RosterMember_inherit_preferred_job_override"
AFTER INSERT ON "RosterMember"
FOR EACH ROW
EXECUTE FUNCTION inherit_preferred_roster_job_override();
