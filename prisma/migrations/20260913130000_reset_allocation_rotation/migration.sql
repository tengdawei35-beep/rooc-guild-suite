-- Allocation was rebuilt from the agreed Rotation Pool / Reserved Pool rules.
-- Historical recovery entries and rotation positions must not influence the fresh rotation.
DELETE FROM "RotationRecovery";

UPDATE "RotationState"
SET "rotationIndex" = 0,
    "updatedAt" = CURRENT_TIMESTAMP;
