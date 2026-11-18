# HMDL RO3 Recruitment Application Specification (B1)

Status: Design specification; no database migration or runtime implementation.

## 1. Form composition

The recruitment form is selected from the guild GameType resolved by the invite token on the server. Client-supplied GameType is not trusted.

### Shared application fields
- Discord identity (linked identity)
- Character name (required)
- Class/job (required; RO3-owned list)
- Character level (required; RO3 validation)
- Main role/preferred position (RO3-owned role list; required only once roles are defined)
- Remarks (optional)

### RO3-owned fields
The RO3 adapter owns all additional character attributes, combat statistics, gear/equipment, progression requirements, validation, and future attachments. Exact stat names, level ranges, class lists, role taxonomy and equipment structure remain to be verified against the target RO3 version and user-approved requirements; do not infer them from ROOC.

## 2. Payload format

Payloads are structured JSON, validated and normalized by the adapter. Proposed envelope:

```json
{
  "schemaVersion": 1,
  "character": {
    "name": "string",
    "class": "string",
    "level": "number"
  },
  "role": "string or null",
  "attributes": {},
  "equipment": {},
  "remarks": "string or null"
}
```

The envelope is illustrative. Final typed validation will be enforced in the RO3 adapter; unknown fields should be rejected or handled deliberately rather than silently accepted.

## 3. Proposed persistence model

Add a `GuildApplicantGameData` model (one record per applicant):
- `id`: String primary key
- `applicantId`: String, unique, FK to GuildApplicant
- `gameType`: GameType
- `payload`: Json
- `schemaVersion`: Int
- `createdAt`, `updatedAt`

Relationship should cascade when the parent application is deleted, consistent with applicant data lifecycle. Preserve the existing applicant record and all ROOC stat columns. No backfill or reinterpretation of existing records is proposed.

## 4. Submission pipeline
1. Resolve invite token, applicant invite and guild on server.
2. Read GameType from the guild.
3. Select game adapter from runtime registry.
4. Validate and normalize the payload server-side.
5. Create shared applicant record and game payload in one transaction.
6. ROOC continues its existing scoring/evaluation path during transition.
7. RO3 application never invokes ROOC scoring or writes ROOC stat/score fields.
8. Review and decision workflow stays shared.
9. Acceptance invokes game-specific acceptance integration; RO3 must not copy ROOC stat columns into GuildMember.

## 5. Review experience
Shared applicant list displays identity, character name, game-specific class/level and status. Application detail uses the game adapter to render game-specific payload fields. Initially RO3 review is manual; no score, percentile, DPS/tank/PvP assessment or ROOC comparisons are calculated for RO3.

## 6. Migration and rollout safeguards
- Additive migration only.
- No destructive edits to existing GuildApplicant fields.
- No changes to existing ROOC application submission, OCR, evaluation or acceptance without regression coverage.
- Token resolves game type server-side.
- Enforce guild scoping at all endpoints.
- Apply migration only after backup verification and Preview validation.
- Rollback plan must account for new payload rows; do not drop or modify existing applicant data.

## 7. Decisions requiring user/game-specific confirmation before field implementation
- RO3 version/server and class/job list
- Character level and any secondary level fields/ranges
- Main role/position choices
- Exact attributes/combat stat fields and units
- Equipment/gear schema and whether links/screenshots are supported
- Whether application field values are required, optional or conditionally required
