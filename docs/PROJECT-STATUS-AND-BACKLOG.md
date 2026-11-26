# Heimdall production status and development backlog

**Audit date:** 2026-11-27  
**Audited branch:** `main`  
**Audited commit:** `ff521ca28153742935e518c7fa9d5f40ebe55a18`  
**Production:** `https://hmdl.vercel.app`

This document is the current engineering backlog snapshot. It separates repository evidence, user-confirmed production outcomes, and work that still needs validation. A route, component, or API existing in source does not by itself prove its end-to-end production workflow has been manually tested.

## Executive status

- The latest `main` commit has a successful GitHub Actions CI run and successful Vercel status check.
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
| OCR/stat entry | Member OCR API and page, applicant OCR API, RO3 and ROOC parsers exist. | Implemented foundation; extraction accuracy and workflow need review |
| Combat simulator | Authenticated, entitlement-gated `/combat-simulator` currently renders `NativeCombatSimulatorPreview`; native engine, data adapters, profile API and tests exist. | Native route in production; parity/regression audit required |
| Simulator entitlement/billing | Personal and guild simulator subscription routes and admin access controls exist. | Implemented surfaces; verify Stripe configuration and lifecycle |

## Immediate engineering priorities

### P0 — Reconcile combat simulator implementation and documentation

1. Treat the current native React `/combat-simulator` route as the production UI; confirm this with a browser smoke test using an entitled RO3 account.
2. Test attacker and defender profile loading, including RO3 JSON stats fallback, empty/missing stats, and manual override behavior.
3. Test job switching, career-specific skills/equipment, named selectors, saved builds, legacy build import, talents, pets, cards, totems, reports and calculation lifecycle.
4. Confirm no active production route depends on the old iframe message bridge. Keep the upstream/legacy HTML only where required as the authoritative calculation source/data extraction input.
5. Preserve the existing rule: the simulator is the current engineering reference, not independently validated live-game truth. Do not change formulas as part of UI migration.
6. Update `docs/ro3-combat-simulator-native-migration.md` so its production-path and phase-status statements agree with the code.

**Related open PRs**
- #147 — name-based controls and job-selectable attacker. Its changes are relevant to the native React component and should be reviewed against current `main`, then either ported cleanly or closed as superseded.
- #146 — guild profile stats fallback. The same fallback logic is already present in the current `main` API route; confirm commit history, then close as superseded if no unique changes remain.
- #136 — legacy iframe profile-import rendering fix. Reassess because the production route now renders native React.
- #137 — browser wallet-extension error isolation in legacy iframe. Reassess whether any remaining production path uses that iframe.
- #149 — job/totem label fixes and level-99 default are already merged; retain those as the current baseline.

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

- Review PR #132 (actionable Discord role-backfill diagnostics) against the current Discord role mapping/backfill implementation.
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
| #147 | Native simulator named controls / job selector | Review and port any still-missing native UI work |
| #146 | Simulator profile stat fallback | Likely superseded; current main API already contains the fallback |
| #142 | RO3 Tank/PvP scoring composition | Important candidate; rebuild/rebase and review, do not merge as-is |
| #137 | Wallet extension errors in iframe | Check whether legacy iframe remains active; likely obsolete |
| #136 | Legacy iframe profile import rendering | Check whether legacy iframe remains active; likely obsolete |
| #132 | Discord role backfill diagnostics | Review against current implementation and rebase if still needed |
| #129 | Guild-specific applicant-link branding | Verify current applicant page metadata/UI; rebase if still missing |
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
4. Audit OCR and applicant/member stat workflows end to end.
5. Audit Discord role synchronization and event interactions.
6. Audit admin/billing permissions and lifecycle.
7. Run the current-production UX/accessibility regression pass.

## Validation boundaries

- CI success proves automated checks for that commit passed; it does not prove browser workflow, mobile layout, third-party integration or production data correctness.
- A successful Vercel deployment status proves deployment completion; it does not prove every route is healthy.
- The user confirmed the applicant watchlist works and its migrations were applied. Other production workflows in this document are not marked manually verified unless explicitly stated.
- RO3 live-game formula validation remains blocked until the game is available and representative real gameplay data can be collected.
