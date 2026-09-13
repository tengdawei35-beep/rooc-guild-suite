-- Fresh allocation rebuild: no historical recovery entitlement should carry into the first new rotation.
-- Safe to run after the previous reset migration; this is intentionally idempotent.
DELETE FROM "RotationRecovery";

UPDATE "RotationState"
SET "rotationIndex" = 0,
    "updatedAt" = CURRENT_TIMESTAMP;
