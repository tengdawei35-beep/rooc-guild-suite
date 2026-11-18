# HMDL Game Boundary Implementation Notes (B1.1)

## Objective
Incrementally separate shared HMDL infrastructure from game-specific rules without changing operational ROOC behavior or introducing database migrations in B1.1.

## Implemented boundary scaffolding
- Game runtime types and registry.
- Separate ROOC and RO3 module entry points.
- Application adapter contract.
- ROOC job definitions now owned by `src/lib/games/rooc/jobs.ts`.
- `src/lib/constants/jobs.ts` remains a compatibility re-export.
- ROOC DPS classification is owned by the ROOC jobs module.
- Ranking refresh uses ROOC-boundary imports for scoring and DPS classification.

## Application architecture decision
Applications are game-specific, while the application lifecycle is shared.
The guild's GameType (resolved server-side from the invite's guild) selects the form schema, validation and game-specific data handler. The client cannot choose the game type.

Shared lifecycle responsibilities: Discord identity, invite, guild, duplicate handling, status, remarks, reviewer, decision timestamps, notification, and accepted-member integration.

Game modules own application fields, validation, game-specific attachments/OCR, and evaluation. ROOC scoring must not run for RO3. Acceptance must not copy ROOC stat columns for RO3.

## Applicant storage direction (not yet implemented)
Avoid adding RO3 fields to the existing ROOC-oriented GuildApplicant columns. Keep shared application metadata separate from game-specific payloads or game-specific data models. Final schema choice and migration plan require review before implementation.

## Safety constraints
- No migrations in B1.1.
- No destructive changes.
- Preserve ROOC form, OCR, evaluation, comparison and acceptance behavior.
- Guild scoping and server-side GameType determination remain mandatory.
- No RO3 validation/scoring placeholder may be presented as implemented functionality.
- Validate build and runtime behavior locally/Preview before merging; remote file edits alone do not constitute build verification.

## Remaining work
1. Complete runtime dependency audit for dashboard, notifications, Call to Arms and statistics.
2. Finalize additive applicant schema and migration strategy.
3. Port application submission and acceptance flow using game adapters.
4. Extract remaining ROOC-specific event, roster and distribution rules incrementally.
