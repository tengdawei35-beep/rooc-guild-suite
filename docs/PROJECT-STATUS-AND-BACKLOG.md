# Heimdall production status and development backlog

**Audit date:** 2026-11-27  
**Audited branch:** `main`  
**Audited commit:** `ff521ca28153742935e518c7fa9d5f40ebe55a18`  
**Production:** `https://hmdl.vercel.app`

This document is the current engineering backlog snapshot. It separates repository evidence, user-confirmed production outcomes, and work that still needs validation. A route, component, or API existing in source does not by itself prove its end-to-end production workflow has been manually tested.

## Executive status

- The latest documentation and applicant-link changes have passed GitHub Actions CI; the post-merge Vercel deployment status must still be checked separately.
- The user confirmed that the applicant watchlist and both related production database migrations were applied and are working.
- The production `/combat-simulator` page currently renders the native React workspace. The old migration notes below it in `docs/ro3-combat-simulator-native-migration.md` still describe the former iframe production path and must be reconciled.
- The repository contains a substantial legacy pull-request backlog. Many PRs target historical base commits and are stacked on earlier feature branches; they must not be merged as a batch.
- Admin pages, subscription administration, OCR endpoints, and member-stat update surfaces already exist in the current source tree. They should be audited for completeness rather than tracked as wholly unimplemented features.

## Confirmed completed

| Area | Current implementation evidence | Status |
|---|---|---|
| Guild operations | Member, event, roster, resource, allocation, reservation, bidding and history workspaces are present in the application. | Implemented; retain regression coverage |
| Event operations | Event management, attendance, roster/results workflows and Discord attendance integration are present. | Implemented; retain regression coverage |
| Discord event reminders | 1-hour and 15-minute reminders were merged in PR #153. | Merged; production check passed |
| HMDL branding | Official brand identity was applied across the application in PR #133. | Merged |
| Onboarding | Guild Getting Started checklist and Discord webhook tutorial were added in PR #116. | Merged |
| Applicant management | Applicant queue, invite/application flow, decisions and OCR endpoints are present. | Implemented; end-to-end validation remains |
| Applicant watchlist | Green / Yellow / Red labels and applicant filtering were merged in PR #154. | Production confirmed working |
| Applicant watchlist presets | Admin/Manager preset page, guild-scoped IGN records and automatic case-insensitive matching for RO3/ROOC submissions were merged in PR #155. | Production confirmed working; migrations applied by user |
| Admin workspaces | Admin dashboard, guilds, users, subscriptions, affiliates, creator management, impersonation and Discord settings routes exist. | Implemented surfaces; audit workflows/permissions |
| OCR/stat entry | Member OCR API/page, applicant OCR API, RO3/ROOC parsers and separate RO3 stat schema exist. | Foundation implemented; #8 self-service entry/identity prefill and Vercel protection remain unresolved; #1/#9 screenshot accuracy and hybrid-role end-to-end verification remain open |
| Combat simulator | Authenticated, entitlement-gated `/combat-simulator` currently renders `NativeCombatSimulatorPreview`; native engine, data adapters, profile API and tests exist. | Native route in production; parity/regression audit required |
| Simulator entitlement/billing | Personal and guild simulator subscription routes and admin access controls exist. | Implemented surfaces; verify Stripe configuration and lifecycle |

## Repository audit updates (2026-11-27 continuation)

### PRs resolved
- **#156** — project status/backlog and native simulator documentation correction; merged after CI passed.
- **#132** — actionable Discord role-backfill diagnostics; merged after CI run #354 passed and Vercel preview status succeeded. The change now preserves safe Discord HTTP status/message details and identifies role assign/remove operations in backfill failures.
- **#146** — closed as superseded; current `main` already contains the RO3 profile stat fallback.
- **#147** — closed as superseded; current native React simulator already contains the named selectors, job selection and career-aware controls.
- **#136** — closed as superseded; the retained legacy HTML already uses `refresh()` for both attacker and defender profile imports.
- **#137** — closed as obsolete for the production UI; the production simulator is native React and does not embed the legacy iframe. The legacy source endpoint remains a compatibility asset, not the active simulator UI.
- **#129** — historical PR closed after its TypeScript failure was traced to an invalid nested Prisma relation select. Its intended guild-specific metadata and authenticated-form branding were rebuilt correctly in **#157**.
- **#157** — applicant-link guild branding rebuilt from current `main`; CI passed (run #750: combat engine tests, Prisma generation/migrations, TypeScript, ESLint and production build) and merged as `004176bc6f38180dbb7de99238245b4661034c63`. Vercel preview check was successful before merge.

### Issue reconciliation
- **#9 — RO3 jobs and stat schema:** the initial seven-job RO3 list, separate `RO3_STAT_FIELDS` schema, member edit/display fields, applicant snapshots and RO3 OCR parser are present. Keep open only for the remaining acceptance gaps: screenshot accuracy, hybrid role classification (Royal Guard/Rune Knight DPS vs Tank), and full end-to-end verification. The original issue is not fully complete merely because the schema exists.
- **#8 — public applicant access/member OCR entry point:** app route and Discord authentication flow exist, as do the OCR page/API and member-scoped permission checks. However, the reported Vercel Deployment Protection setting cannot be verified or changed through this repository workflow, and a discoverable member self-service OCR entry point with identity prefill was not found in the members workspace. Keep open; user action is required to confirm/configure public access in Vercel.
- **#2 — applicants and reusable ROO scoring:** applicant queue, reusable invite flow, review/accept/deny and ROOC stat/scoring primitives exist. Do not close until the remaining acceptance criteria (projected PVP/DPS/Tank percentiles and closest-member comparison) are verified against current code and UI.
- **#1 — ROO OCR screenshot accuracy:** keep open. Parser code exists, but the requested screenshot-by-screenshot comparison against the roo-stats-bot reference and supplied screenshot layouts has not been reproduced in this audit.

## Immediate engineering priorities

### P0 — Reconcile combat simulator implementation and documentation

1. Treat the current native React `/combat-simulator` route as the production UI; confirm this with a browser smoke test using an entitled RO3 account.
2. Test attacker and defender profile loading, including RO3 JSON stats fallback, empty/missing stats, and manual override behavior.
3. Test job switching, career-specific skills/equipment, named selectors, saved builds, legacy build import, talents, pets, cards, totems, reports and calculation lifecycle.
4. Confirm no active production route depends on the old iframe message bridge. Keep the upstream/legacy HTML only where required as the authoritative calculation source/data extraction input.
5. Preserve the existing rule: the simulator is the current engineering reference, not independently validated live-game truth. Do not change formulas as part of UI migration.
6. Update `docs/ro3-combat-simulator-native-migration.md` so its production-path and phase-status statements agree with the code.

**Related PR disposition**
- #147 and #146 are closed as superseded; no further porting is planned unless a regression is found.
- #136 is closed; the retained legacy HTML already uses `refresh()` for both attacker and defender profile imports.
- #137 is closed as obsolete for the production UI; the legacy source endpoint is retained only as a compatibility/calculation asset.
- #132 is merged with actionable Discord role-backfill diagnostics.
- #129 is closed and replaced by #157, which is merged. #149's job/totem label fixes and Level 99 default remain part of the current baseline.

### P1 — RO3 scoring: separate composition from calibration

The current `main` scoring module is `RO3_PRELIMINARY_V1` and accepts normalized component inputs. It is not a complete raw-stat-to-score pipeline.

Open PR #142 contains a much larger `RO3_MEMBER_V2` scoring and calibration effort (92 commits, 28 files, 2,421 additions at audit time) and currently has merge conflicts against its historical base. It must not be merged as-is.

Review it in a fresh branch against current `main`, with these guardrails:
- Preserve the user's decision that the embedded simulator is authoritative for current damage-derived calculations until explicitly superseded.
- Keep simulator-backed DPS evaluation, raw-stat normalization, Tank context, PvP composition, and presentation as separate layers.
- Do not imply that synthetic fixtures or sensitivity reports validate live-game mechanics.
- Do not calibrate population percentiles from a production cohort until the user confirms that the RO3 database contains a sufficiently meaningful sample.
- Preserve explicit Royal Guard DPS/Tank and Rune Knight DPS/Tank classifications where the product requires them; do not confuse those labels with simulator career IDs.
- Document every unsupported or unverified stat mapping and avoid double-counting overlapping modifiers.
- Keep score versions and per-component explanations for historical reproducibility.

### P1 — OCR and member/applicant data pipeline

Current code includes:
- `src/app/guild/members/ocr`
- `src/app/api/guild/members/ocr/route.ts`
- `src/app/api/apply/[token]/ocr/route.ts`
- RO3 and ROOC OCR parser modules.

Audit the full path: screenshot upload → OCR extraction → job/character identification → field normalization → user review/correction → authorized save → profile refresh. Validate both RO3 and ROOC screenshot formats, multi-image handling, malformed/low-confidence results, and member self-service permissions.

Open issues:
- #9 — RO3 job classes and OCR/stat collection.
- #8 — public applicant access and member OCR stats update workflow.
- #2 — guild applicants and reusable ROO scoring.
- #1 — improve member OCR to match ROO screenshot layouts.

These issues are older than the current applicant and OCR implementations. Reconcile each against current code before deciding whether it remains actionable or can be closed.

### P1 — Discord integration and role synchronization

- PR #132's actionable Discord role-backfill diagnostics are merged. Remaining work is integration QA: test bot permissions, role hierarchy, missing-member handling, assign/remove operations, and retry behavior.
- Test bot permissions, role hierarchy, missing-member handling, assign/remove operations, and retry behavior.
- Verify event reminders and attendance interactions in a real test guild, including the bot's permission to mention everyone.
- Never expose bot tokens, webhook secrets, or private Discord identifiers in logs or diagnostics.

### P2 — SaaS administration and billing

Admin routes already exist for guilds, users, subscriptions, affiliates, guild creators, impersonation, Discord settings and combat-simulator access. The next task is a role/permission and workflow audit, not creating duplicate dashboards.

Verify:
- Platform-admin authorization is enforced server-side on every API, not just hidden in navigation.
- Guild scoping prevents cross-guild data access.
- Subscription state, Stripe checkout, portal, renewals, cancellations, failed payments and entitlement revocation stay synchronized.
- Personal simulator subscriptions remain distinct from guild add-on subscriptions and base guild plans.
- Admin impersonation is explicit, auditable and cannot bypass intended permission boundaries.

### P2 — UX and accessibility regression

The shared HMDL design system, branding and page-sizing work have been implemented in several merged PRs. Run a fresh screenshot-led browser audit of current production rather than replaying historical styling PRs.

Cover management and member experiences at desktop, tablet and mobile widths; loading/empty/error states; keyboard navigation; focus visibility; dialogs; tables; and role-specific navigation.

## Open pull-request triage

The GitHub repository currently has a large open-PR backlog. Several older PRs are based on historical commit SHAs rather than the current `main` commit. Open status does not mean work is missing from production.

| PR | Subject | Audit disposition |
|---|---|---|
| #147 | Native simulator named controls / job selector | Closed as superseded by current native React implementation |
| #146 | Simulator profile stat fallback | Closed as superseded by current main API implementation |
| #142 | RO3 Tank/PvP scoring composition | Important candidate; rebuild/rebase and review, do not merge as-is |
| #137 | Wallet extension errors in iframe | Closed; legacy iframe is not the production simulator UI |
| #136 | Legacy iframe profile import rendering | Closed; current legacy asset already uses `refresh()` |
| #132 | Discord role backfill diagnostics | Merged after CI and Vercel preview success |
| #129 | Guild-specific applicant-link branding | Closed; replaced by merged #157 |
| #157 | Guild-specific applicant-link branding | Merged after CI and Vercel preview success |
| #105 | Page-sizing audit documentation | Historical audit; compare with merged sizing work |
| #102 | Application UX audit documentation | Historical audit; compare with current audit docs |
| #96 | Screenshot-led visual corrections | Compare each correction with current production before closing |
| #95–#55 | Sequential UX/workspace phase PRs | Legacy stacked sequence; inspect changed paths and confirm whether changes were incorporated by later merged work before closing |
| #30 | Discord-linked members in Call To Arms | Verify current identity matching in the live CTA workflow before deciding |

The legacy UX sequence (#55–#95) must be triaged individually or by exact changed-file/commit comparison. Do not close the entire sequence merely because PR #106 merged a later workspace-sizing consolidation.

## Backlog hygiene procedure

For every open PR:
1. Compare its changed files and patch against current `main`.
2. Mark it **already implemented**, **still needed**, **partially superseded**, or **obsolete**.
3. If still needed, port only the missing changes onto a fresh branch from current `main`.
4. Run CI and review the final diff.
5. Close the historical PR only after the replacement is merged or the duplicate implementation is confirmed.
6. Never merge old stacked branches directly into current `main`.

For every open issue:
1. Reproduce/inspect the described behavior against current source.
2. Link the relevant current route/API and implementation.
3. Close only if the acceptance criteria are demonstrably satisfied.
4. Convert remaining work into explicit, testable acceptance criteria.

## Recommended execution order

1. Finish PR and issue triage; update this document with final dispositions.
2. Complete native combat simulator regression and documentation reconciliation.
3. Rebuild/review RO3 scoring work from current `main`, without claiming live-game calibration.
4. Audit Discord role synchronization and event interactions.
5. Audit admin/billing permissions and lifecycle.
6. Run the current-production UX/accessibility regression pass.

## Validation boundaries

- CI success proves automated checks for that commit passed; it does not prove browser workflow, mobile layout, third-party integration or production data correctness.
- A successful Vercel deployment status proves deployment completion; it does not prove every route is healthy.
- The user confirmed the applicant watchlist works and its migrations were applied. Other production workflows in this document are not marked manually verified unless explicitly stated.
- RO3 live-game formula validation remains blocked until the game is available and representative real gameplay data can be collected.


## Audit follow-up — 2026-11-27

### Completed repository and UX triage
- **PR #158** — merged; canonical backlog reconciled.
- **PR #159** — merged; complimentary guild access no longer overwrites Stripe-managed subscription history. Grants are blocked while a Stripe subscription remains non-canceled, and entitlement resolution now prefers a currently active subscription over canceled historical rows.
- **PR #162** — merged; added the missing page-level authentication and `allocation.view` guard to `/guild/resources/history`, and refreshed the historical Phase 43/45 audit documents.
- **PR #106** remains the merged page-sizing implementation baseline. Browser screenshot QA at desktop/tablet/mobile widths remains outstanding.
- The legacy UX stack **#55–#74, #76–#91, and #93–#96** was closed as superseded by current `main` and later merged workspace/design-system work. These stale phase branches were not merged directly.
- **#102 and #105** were replaced by the refreshed historical audit snapshots in PR #162 and closed.
- **#75 and #92** remain open and were deliberately not audited in this pass because they include the member-stat/OCR workflow scope that was explicitly deferred.
- Empty/no-op PR #161 was closed after confirming the Event Results action already uses the shared HMDL secondary button in current `main`.

### Native RO3 simulator and scoring rebuild
- Historical **PR #142** is being rebuilt against current `main` in **PR #160**; do not merge the historical stacked branch.
- The rebuild keeps the composition model explicitly experimental (`RO3_MEMBER_V2_EXPERIMENTAL`). No final numeric DPS/Tank/PvP weights have been approved, and no score is wired into member rankings or persisted fields.
- The embedded simulator remains authoritative for supported damage mechanics. Live-game validation is not a prerequisite for the current engineering work.
- Only direct PATK/MATK inputs are eligible for offensive calibration until percentage-field source/aggregation semantics are verified. Penetration and incoming-damage mechanics remain excluded where the simulator does not model them.
- Rotation evaluation refuses to substitute career-sheet attack defaults when the required persisted PATK/MATK value is missing. Royal Guard's simulator profile references a career ID without a matching `JobConfig` row; the evaluator reports this gap rather than falling back to another career.
- The defensive baseline exporter is restricted to active **and eligible** Archbishop, Royal Guard (Tank), and Rune Knight (Tank) characters across all RO3 guilds, with independent average PDEF/MDEF. It has not been run because the current RO3 database does not contain a meaningful sample.

### Admin permissions and billing audit
- All nine current `/admin` page routes were inspected and use server-side `getPlatformAdmin()` checks before rendering platform data.
- Sensitive admin APIs reviewed (guild access, impersonation, simulator access, affiliates, guild creators and Discord role mappings) enforce platform-admin authorization; impersonation also validates request origin and records audit activity.
- Billing checkout/portal routes require a platform session and verify guild ownership where applicable; the Stripe webhook verifies the signature before processing events.
- **PR #159** fixes a data-integrity defect in complimentary grants: Stripe subscription identifiers/history are preserved, unresolved Stripe subscriptions block a grant, and active entitlements take precedence over canceled historical rows.
- **Issue #163** tracks a product decision: an active complimentary subscription currently blocks paid Stripe checkout. Decide whether complimentary guilds should be able to convert to paid plans before expiry.
- Remaining validation is live Stripe lifecycle testing (checkout success/cancel/failure, portal, renewals, past-due recovery, cancellation, entitlement revocation and concurrent grant/checkout behavior). No live Stripe transaction was run in this audit.
- Minor follow-up: `/admin/guild-creators` idempotently upserts Basic/Total plans on page render. Consider moving this seeding side effect to a controlled seed/migration or admin action rather than a GET request.

### Deferred scope
- OCR accuracy, member stat entry/self-service workflows and their related PRs/issues were not audited or changed in this continuation, as requested. Keep Issues #1/#8/#9 and PRs #75/#92 in their existing open state until that work is resumed.
