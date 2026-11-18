# HMDL RO3 Recruitment Application Specification (B1)

Status: RO3 V1 jobs and stat fields defined; runtime adapter scaffold implemented on feature branch. Application UI and persistence integration remain pending.

## 1. Shared fields
- Discord identity resolved through the shared application flow
- Character name (required)
- Job (required; RO3 job catalogue)
- Character stats (required)
- Remarks (optional)

## 2. RO3 jobs (V1)
- Mechanic
- Royal Guard
- Rune Knight
- Warlock
- Ranger
- Archbishop
- Guillotine Cross

The catalogue is module-owned and extendable.

## 3. RO3 character stats
Numeric stats: HP, PATK, MATK, PDEF, MDEF.

Percentage stats:
- Healing Done
- Crit Damage
- Crit Damage Reduction
- Physical Damage Bonus
- Physical Damage Reduction
- Magic Damage Bonus
- Magic Damage Reduction
- Damage Increase
- Damage Reduction
- Physical Penetration
- Magic Penetration
- DMG vs All Job
- DMG Reduction vs All Job
- DMG vs Medium Enemy
- DMG Reduction vs Medium Enemy

Special Dish slots (integer range 0–50):
- Slot 1, initial label: Blade Crystal
- Slot 2, initial label: Shield Crystal
- Slot 3, initial label: Mana Crystal
- Slot 4, initial label: Magic DEF Crystal

Special dish names are season-adjustable labels. Stable slot identifiers are used for data storage.

## 4. Payload shape
The adapter normalizes a payload with schemaVersion 1, characterName, job, stats (20 standard stats and 4 dish slots), and remarks.

## 5. Persistence and lifecycle
- Shared applicant lifecycle remains on GuildApplicant.
- Game-specific data is stored in GuildApplicantGameData JSON payload.
- The same stat definition is intended to serve applicant snapshots and member character-stat records.
- Acceptance must not copy RO3 payload into ROOC stat columns or invoke ROOC scoring.
- Member persistence integration is not yet implemented.

## 6. Guardrails
- GameType is resolved from the invite's guild server-side, never trusted from client payload.
- No ROOC scoring, OCR or stat logic is used for RO3.
- Additive migration only; preserve existing ROOC applicant data and history.
- The existing migration for GuildApplicantGameData is not applied as part of this work.
