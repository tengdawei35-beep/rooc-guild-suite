# Heimdall production status and development backlog

**Audit date:** 2026-11-27  
**Audited branch:** `main`  
**Audited commit:** `b354d040c8cc02bd3357e97718bf07a28cab77f3`  
**Production:** `https://hmdl.vercel.app`

This document is the current engineering backlog snapshot. It separates repository evidence, user-confirmed production outcomes, and work that still needs validation. A route, component, or API existing in source does not by itself prove its end-to-end production workflow has been manually tested.

## Executive status

- PR #160 has merged. Its latest full CI run passed TypeScript, Prisma generation/migrations, combat-engine tests, the RO3 scoring/sensitivity suite, ESLint and production build. The main-branch CI and Vercel production deployment were still running at this audit snapshot.
- The user confirmed that the applicant watchlist and both related production database migrations were applied and are working.
- The production `/combat-simulator` page renders the native React workspace. `docs/ro3-combat-simulator-native-migration.md` now has a current-status correction at the top; older iframe-path checkpoints below it are historical and should be explicitly labeled during the next documentation cleanup.
- The historical UX stack has been triaged. Only PRs #75 and #92 remain open from that sequence; both are intentionally deferred because they overlap the member-stat/OCR scope.
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

The current `main` retains `RO3_PRELIMINARY_V1` and adds `RO3_MEMBER_V2_EXPERIMENTAL` in `scoring-v2-experimental.ts`. The experimental module accepts normalized component inputs only; it is not a complete raw-stat-to-score pipeline and is not used by production rankings.

Historical PR #142 (92 commits, 28 files) was rebuilt on current `main` and closed as superseded by merged PR #160. The new `scoring-v2-experimental.ts` module is isolated from production scoring; no final numeric DPS/Tank/PvP weights have been approved and no score is wired into rankings or persisted fields.

Retain these guardrails for all follow-up work:
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

The first authorization pass is complete: all nine `/admin` page routes use server-side `getPlatformAdmin()` guards, and the reviewed sensitive admin APIs enforce platform-admin authorization. Billing checkout/portal routes require a platform session and verify guild ownership where applicable; the Stripe webhook verifies signatures. PR #159 fixed complimentary-grant history/entitlement selection.

Remaining validation:
- Exercise guild scoping across all admin and billing APIs with multiple guild memberships.
- Test Stripe checkout, portal, renewals, cancellations, failed payments, past-due recovery and entitlement revocation in a safe test environment.
- Decide Issue #163: whether active complimentary access should be convertible to a paid subscription before expiry.
- Verify personal simulator subscriptions remain distinct from guild add-on subscriptions and base guild plans.
- Confirm impersonation audit records and permission boundaries in a real admin test session.

### P2 — UX and accessibility regression

The shared HMDL design system, branding and page-sizing work have been implemented in several merged PRs. Run a fresh screenshot-led browser audit of current production rather than replaying historical styling PRs.

Cover management and member experiences at desktop, tablet and mobile widths; loading/empty/error states; keyboard navigation; focus visibility; dialogs; tables; and role-specific navigation.

## Pull-request disposition

The historical PR sequence is now closed except for #75 and #92, which remain open by explicit scope deferral. Open status does not mean work is missing from production.

| PR | Subject | Audit disposition |
|---|---|---|
| #147 | Native simulator named controls / job selector | Closed as superseded by current native React implementation |
| #146 | Simulator profile stat fallback | Closed as superseded by current main API implementation |
| #142 | RO3 Tank/PvP scoring composition | Closed; rebuilt and superseded by merged PR #160 |
| #160 | Rebuilt experimental RO3 scoring framework | Merged after full CI passed; no production score integration |
| #137 | Wallet extension errors in iframe | Closed; legacy iframe is not the production simulator UI |
| #136 | Legacy iframe profile import rendering | Closed; current legacy asset already uses `refresh()` |
| #132 | Discord role backfill diagnostics | Merged after CI and Vercel preview success |
| #129 | Guild-specific applicant-link branding | Closed; replaced by merged #157 |
| #157 | Guild-specific applicant-link branding | Merged after CI and Vercel preview success |
| #105 | Page-sizing audit documentation | Closed; refreshed historical snapshot merged in PR #162 |
| #102 | Application UX audit documentation | Closed; refreshed historical snapshot merged in PR #162 |
| #96 | Screenshot-led visual corrections | Closed; all remaining styles were already present in current `main` |
| #95–#55 | Sequential UX/workspace phase PRs | Closed as superseded, except #75 and #92 which remain open and deferred because they overlap the OCR/member-stat scope |
| #30 | Discord-linked members in Call To Arms | Closed on 2026-11-26 |
| #75 | Member Stat Update Workspace | Open; intentionally deferred with OCR/member-stat audit scope |
| #92 | Member workflow and billing confirmation consistency | Open; intentionally deferred because it includes OCR/member-stat workflow changes |

The legacy UX sequence has been triaged against current routes/components and later merged design-system work. The obsolete stacked PRs were closed rather than merged directly; #75 and #92 remain open for the deferred member-stat/OCR pass.

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

1. Complete native React simulator browser regression and reconcile `docs/ro3-combat-simulator-native-migration.md`.
2. Keep RO3 scoring experimental until the user approves numeric weights and the production cohort is meaningful; do not wire scores into rankings yet.
3. Complete Discord role synchronization and event interaction QA.
4. Complete live Stripe lifecycle testing and resolve Issue #163's complimentary-to-paid product decision.
5. Run the current-production UX/accessibility regression pass at desktop, tablet and mobile widths.
6. Resume the explicitly deferred OCR/member-stat workflow audit only when requested.

## Validation boundaries

- CI success proves automated checks for that commit passed; it does not prove browser workflow, mobile layout, third-party integration or production data correctness.
- A successful Vercel deployment status proves deployment completion; it does not prove every route is healthy.
- The user confirmed the applicant watchlist works and its migrations were applied. Other production workflows in this document are not marked manually verified unless explicitly stated.
- Under the current simulator-authority decision, live-game formula validation is not a prerequisite for engineering work. If a future product decision requires in-game calibration, wait until the game is available and representative gameplay data can be collected.


## Audit follow-up — 2026-11-27

### Completed repository and UX triage
- **PR #158** — merged; canonical backlog reconciled.
- **PR #159** — merged; complimentary guild access no longer overwrites Stripe-managed subscription history. Grants are blocked while a Stripe subscription remains non-canceled, and entitlement resolution now prefers a currently active subscription over canceled historical rows.
- **PR #162** — merged; added the missing page-level authentication and `allocation.view` guard to `/guild/resources/history`, and refreshed the historical Phase 43/45 audit documents.
- **PR #160** — merged after full CI passed; rebuilt the RO3 simulator-backed evaluation and experimental scoring framework from current `main`.
- **PR #142** — closed as superseded by #160.
- **PR #163** — open product-decision issue for complimentary-to-paid conversion.
- **PR #106** remains the merged page-sizing implementation baseline. Browser screenshot QA at desktop/tablet/mobile widths remains outstanding.
- The legacy UX stack **#55–#74, #76–#91, and #93–#96** was closed as superseded by current `main` and later merged workspace/design-system work. These stale phase branches were not merged directly.
- **#102 and #105** were replaced by the refreshed historical audit snapshots in PR #162 and closed.
- **#75 and #92** remain open and were deliberately not audited in this pass because they include the member-stat/OCR workflow scope that was explicitly deferred.
- Empty/no-op PR #161 was closed after confirming the Event Results action already uses the shared HMDL secondary button in current `main`.

### Native RO3 simulator and scoring rebuild
- Historical **PR #142** was closed as superseded by **merged PR #160**; the old stacked branch was not merged.
- The rebuild keeps the composition model explicitly experimental (`RO3_MEMBER_V2_EXPERIMENTAL`). No final numeric DPS/Tank/PvP weights have been approved, and no score is wired into member rankings or persisted fields.
- The embedded simulator remains authoritative for supported damage mechanics. Live-game validation is not a prerequisite for the current engineering work.
- Only direct PATK/MATK inputs are eligible for offensive calibration until percentage-field source/aggregation semantics are verified. Penetration and incoming-damage mechanics remain excluded where the simulator does not model them.
- Rotation evaluation refuses to substitute career-sheet attack defaults when the required persisted PATK/MATK value is missing. Royal Guard's simulator profile maps to the simulator's Royal Guard career, but career ID `1410` has no matching `JobConfig` row; the evaluator reports this gap rather than falling back to another career.
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


### QA status update — 2026-11-27 (simulator browser checks deferred)
- The user explicitly deferred individual production browser testing due to time constraints. **Do not mark the native simulator end-to-end workflow as verified.**
- The following remain **implemented in source but unverified/untested in an authenticated browser session**: attacker/defender profile import, job switching and career-specific selectors, saved-build save/load/delete, legacy build import, talent/pet/card/totem configuration, simulation execution, report generation, and error/empty-state behavior.
- Automated CI passing is not a substitute for these manual production checks. No live-game formula validation was attempted or required.
- PR **#166** corrected obsolete native-preview messaging and was merged. PR **#167** corrected a second stale comment in the native engine hook and merged after CI passed.
- With simulator browser QA explicitly parked, continue with repository-side Discord integration QA and safe automated billing regression coverage. Keep live Discord permission/role-hierarchy tests and live Stripe lifecycle transactions explicitly **unverified/untested** until a test server or Stripe test environment is available.


### QA continuation — Discord and billing (2026-11-27)

#### Discord integration review
- Source-reviewed the signed interaction endpoint: verifies Ed25519 signatures, checks Discord guild/channel/message against the stored event, enforces the 30-minute attendance lock, resolves an active linked member, verifies the persisted attendance status, and updates the Discord message on a best-effort basis.
- Source-reviewed the event-management cron: requires the configured bearer `CRON_SECRET` and handles recurring event generation plus attendance, 48-hour, 1-hour and 15-minute reminder windows.
- The 1-hour and 15-minute messages explicitly request `@everyone`; this still depends on Discord channel/server permissions and has not been verified in a live test guild.
- **PR #169** merged after CI passed. Subscription-role synchronization now caps concurrent role API requests at five and retries Discord HTTP 429 responses using the returned retry interval (up to four attempts). Existing per-role diagnostics remain.
- Live Discord checks remain **UNVERIFIED / UNTESTED**: bot installation and permissions, role hierarchy, real role assign/remove, missing-member behavior, reminder delivery, `@everyone` mentions, attendance button responses, and cron timing/retry behavior. No live Discord server action was performed.

#### Billing regression coverage
- **PR #170** added a pure guild-entitlement resolver and automated regression cases for active-vs-canceled history precedence, expiry warning thresholds, perpetual access, canceled history display, and empty state. It merged after CI passed.
- This is unit coverage for entitlement resolution only. Stripe checkout, customer portal, webhook signature/event lifecycle, renewals, failed payments, cancellation, past-due recovery, add-on entitlements, and concurrent checkout behavior remain **UNVERIFIED / UNTESTED** in a Stripe test environment.
- **Issue #163** remains open. Complimentary-to-paid conversion is a product decision and has not been changed in code.
- No database schema changes or production transactions were made during this QA continuation.

### QA continuation — admin and billing hardening (2026-11-27)

- **PR #172** merged: added accessible labels and contextual names to Guild Creators admin controls, exposed toggle state, and announced errors. This was a source-level improvement only; keyboard, screen-reader and visual browser QA remain **UNVERIFIED / UNTESTED**.
- **PR #174** merged after full CI passed: removed plan/module upserts from the `/admin/guild-creators` page render. The page now reads active plans without mutating the database during a GET/render. The existing `prisma/seed.ts` remains the controlled plan provisioning path and requires the configured Stripe price IDs; no seed command or production database write was run during this work. If the plan catalog is empty, complimentary grant options will be unavailable until plans are provisioned.
- **PR #175** merged after full CI passed: made base guild checkout webhook processing idempotent by resolving an existing `GuildSubscription` using Stripe's subscription ID before attempting guild creation. Duplicate `checkout.session.completed` deliveries now reuse the existing guild ID and can retry downstream affiliate/Discord synchronization without trying to create the guild again.
- Automated CI for #174 and #175 passed: combat-engine tests, billing entitlement tests, Prisma generation/migration checks, TypeScript, scoring tests, ESLint and production build.
- Latest `main` commit: `af3327c2463a86e654cf56c3afda1f0a5bde62a1`. Vercel deployment status was still pending at the time of this update; do not claim the latest changes are deployed until that status succeeds.
- No production database writes, migrations, Stripe transactions, or live Discord actions were performed as part of these changes.
- Stripe checkout/portal/webhook lifecycle behavior remains **UNVERIFIED / UNTESTED** in a Stripe test environment. The new webhook change has automated CI coverage but no simulated Stripe event replay test.
- Issue #163 remains open for the complimentary-to-paid conversion product decision; no behavior change was made there.

### Billing and production QA continuation — 2026-11-27 (latest)

- **PR #177** merged: subscription lifecycle webhook handlers now retrieve the current Stripe subscription before synchronizing state, preventing an out-of-order event snapshot from overwriting newer subscription status or billing-period values. CI passed; live Stripe event-ordering/lifecycle validation remains **UNVERIFIED / UNTESTED**.
- **PR #178** merged: complimentary guild provisioning now uses a transaction-scoped PostgreSQL advisory lock per owner. Creator eligibility, owned-guild count, Discord guild uniqueness and plan validity are checked inside the locked transaction, preventing concurrent requests from bypassing `maxGuilds`. CI passed; concurrent-request behavior has not been load-tested against a live PostgreSQL environment. No schema migration or production database write was performed.
- **Latest main commit:** `c8cec52bbe04a4cdd66801bd841f0e09a4d398be`. Vercel deployment was pending at the time of this update; verify deployment status before claiming this commit is live.
- **New checkout risk retained for investigation:** both base-plan checkout and combat-simulator add-on checkout perform active-subscription checks before creating Stripe Checkout Sessions, but do not persist a pending-checkout reservation. Concurrent requests may therefore create multiple sessions before a subscription becomes active. Do not add a superficial in-memory/transaction-only lock: a safe fix needs a durable idempotency/reservation design that handles abandoned or expired sessions and legitimate retries. No behavior change has been made; Stripe checkout concurrency remains **UNVERIFIED / UNTESTED**.
- The base checkout webhook's duplicate-delivery recovery from **PR #175** is distinct from preventing multiple separate Stripe subscriptions from concurrent sessions; the former does not eliminate the latter.
- **PR #172** accessibility changes remain source-reviewed only; keyboard and screen-reader browser QA is **UNVERIFIED / UNTESTED**.
- **PR #174** removed GET/render-time plan catalog writes. Plan provisioning remains a controlled seed operation; no production seed was run.
- **Issue #163** remains open as a product decision for complimentary-to-paid conversion. No change made.
- Live Stripe lifecycle tests, Discord integration tests, and authenticated simulator browser tests remain **UNVERIFIED / UNTESTED** as previously recorded. No production Stripe transactions, Discord actions, or database migrations were performed in this continuation.


### Durable checkout reservation design — 2026-11-27

- Added `docs/billing-checkout-reservation-design.md` to specify a shared durable reservation/idempotency protocol for base guild checkout, new-guild onboarding, personal simulator add-on, and guild simulator add-on.
- The design covers unique purchase scopes, request fingerprints, persisted Stripe idempotency keys, attempt/lease recovery, Checkout Session metadata, and duplicate/out-of-order `checkout.session.completed` / `checkout.session.expired` handling.
- This is a design-only change. No checkout behavior, Prisma schema, migration, production database, or Stripe configuration has been changed.
- Next implementation step requires a Prisma schema change and generated SQL migration. The migration may be committed and CI-validated, but must not be applied to production without explicit operator approval. Stripe test-mode concurrency and lifecycle validation remain **UNVERIFIED / UNTESTED**.
- Issue #163 (complimentary-to-paid conversion) remains separate and unchanged.

### Complimentary guild onboarding — 2026-11-28

- **PR #181** merged: fixed the complimentary guild creation advisory-lock query to select a scalar result (`SELECT 1 FROM pg_advisory_xact_lock(...)`) so Prisma 7 can deserialize it. CI passed. The user has confirmed that complimentary guild creation is now fixed in production.
- **PR #182** merged: added a dedicated `/guild/create` onboarding flow for active platform guild creators. First-time eligible creators are routed there directly after Discord sign-in; existing eligible creators can reach it from guild selection. The form collects guild name, Discord server ID, game type and plan, explains the complimentary duration/allowance, and posts to the existing `/api/billing/complimentary` endpoint. Paid guild checkout remains separate.
- PR #182 CI run **45973059248** passed, including combat engine and billing regression tests, Prisma generation/migration checks, TypeScript, RO3 scoring tests, ESLint and production build. No schema changes or migrations were introduced.
- **Deployment boundary:** merge commit `f190342bed021214751c2aa2e0d9b78e3fefbc27`; Vercel deployment was still pending at the time of this update. Do not treat the new onboarding page as live until deployment succeeds.
- New creator onboarding browser workflow remains **UNVERIFIED / UNTESTED**. Once deployed, verify first-time creator redirect, existing creator link, successful provisioning, and non-creator paid onboarding. No production guild was created as part of this change.
- The complimentary provisioning API remains the authoritative eligibility and ownership-limit enforcement path; the page's displayed remaining allowance is informational and is rechecked inside the existing transaction.
