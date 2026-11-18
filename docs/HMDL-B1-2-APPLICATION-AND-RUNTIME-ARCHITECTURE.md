# HMDL Phase B1.2 — Runtime Isolation and Application Data Design

Branch: `feature/b1-1-game-boundaries`  
Status: Audit and additive design only. No schema migration or runtime changes in this document.

## Audit findings

### Notifications
The current guild notification configuration supports roster, bid and stats webhooks. Call-to-Arms webhooks are stored separately. Notification delivery is guild-scoped. This should remain shared infrastructure, with game-aware event/payload providers. Additional notification categories can be added through a shared registry/configuration rather than game-specific webhook storage.

### Call to Arms
The existing lifecycle, signup, participant, capacity, waitlist, announcement and reminder framework is reusable. Matching currently relies on ROOC job constants and generic ROOC-derived role rules. Extract matching/eligibility into the game adapter; preserve existing ROOC behavior as the ROOC implementation. Do not rewrite the lifecycle or migrate its tables as part of the first RO3 work.

### Dashboard and statistics
Homepage and statistics API/UI directly query GuildMember fields, ROOC event conventions, rosters and allocation records. Introduce data-provider interfaces incrementally. Keep shared dashboard layout/navigation and guild activity lifecycle. Providers determine supported metrics and labels by game. Existing ROOC queries remain the ROOC provider until separately tested.

## Recruitment application data design (proposed)

### Shared lifecycle
Keep GuildApplicant as the shared application record for guildId, invite/token relationship, Discord identity, character name display field where needed for compatibility, status, decision/review metadata, timestamps and remarks. Existing ROOC fields remain in place during additive rollout; they are not renamed or removed.

### Additive game payload record
Proposed new model: `GuildApplicantGameData`
- id (cuid)
- applicantId (unique FK to GuildApplicant; cascade on applicant deletion)
- gameType (GameType)
- payload (Json)
- schemaVersion (integer, initially 1)
- createdAt / updatedAt

One game payload per application. The server derives gameType from the guild resolved by the invite token. Client-provided gameType is ignored/rejected. Payload schema validation is performed by the selected game application adapter.

The ROOC application may initially continue writing its existing columns and scoring fields for backward compatibility; the new payload record can be introduced only after mapping and regression tests are agreed. RO3 stores its structured application data in the new payload record and must not invoke ROOC scoring or write ROOC-only score/stat columns.

### Application flow
1. Resolve token and guild on server.
2. Load guild GameType.
3. Select that game's application adapter and schema version.
4. Validate payload server-side.
5. Persist shared lifecycle fields and the game-specific payload.
6. ROOC continues its existing scoring/comparison workflow during transition.
7. RO3 does not run ROOC scoring; review remains manual initially.
8. On acceptance, use a game-specific acceptance adapter. ROOC retains current stat-copy behavior while it is supported. RO3 creates/updates RO3 character data without copying into ROOC columns.

### Initial RO3 applicant payload (subject to game design)
Structured payload, not a fixed Prisma column set:
- character name
- character class/job
- character level
- base/job level fields only if applicable to RO3
- preferred/main role or position
- game-specific character attributes
- equipment/gear summary
- optional applicant remarks

Exact field definitions, mandatory status, ranges and equipment structure must be specified in the RO3 application design before implementation.

## Safeguards
- Additive schema only during initial isolation.
- No dropping, renaming or backfilling existing ROOC columns in this phase.
- No conversion or reinterpretation of existing ROOC records.
- Preserve IDs, FKs and history.
- Enforce guild scope and server-resolved gameType.
- Avoid ROOC scoring, job constants and field assumptions in RO3 adapters.
- Migration requires a verified backup, Preview migration, regression tests and rollback plan.

## Suggested next implementation sequence
1. Finish B1 boundary/documentation review.
2. Finalize RO3 application field specification.
3. Additive schema migration for game-specific application payloads.
4. RO3 submission/review/acceptance adapter implementation.
5. Preview regression tests for ROOC and RO3 invite/application flows.
6. Continue separating character/member profile data and game-aware roster/event providers.
