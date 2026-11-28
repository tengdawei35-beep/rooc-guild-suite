# Heimdall Project Status

_Last updated: 2026-11-28 (Asia/Kuala_Lumpur)_

This is the project-wide handoff file. Update it whenever implementation work advances, a decision changes, a validation run completes, or work is paused. Keep it concise enough to scan, but specific enough that a new ChatGPT conversation can resume without relying on chat history.

## Event detail page design audit — 2026-11-28

**Route:** `/events/[eventId]`  
**Status:** Audit complete; implementation not yet started.  
**User feedback:** The page requires excessive scrolling, several UI blocks consume more space than their importance warrants, and there must be no back-navigation button on this page.

### Findings from the current implementation

1. **Back navigation is redundant and unwanted.** `EventClient.tsx` renders a `← Events` link in all three states: loading, load error, and normal event view. Remove all three. Keep contextual navigation elsewhere (e.g. global sidebar); do not replace it with another back control.
2. **Results content appears too early.** `EventResultsUploader` is rendered immediately after attendance. Its screenshot grid can become very tall and pushes event rules and rosters further down. Move it below the primary roster workflow and make the results area collapsed by default.
3. **Attendance card is oversized for its task.** It uses a large full-width panel, three tall response buttons with explanatory copy, then four separate statistic tiles. Keep the response actions easy to find, but compress them into a compact horizontal control group and render the four counts as a single compact summary strip. Member response details already have a disclosure and pagination; retain that behavior.
4. **Event rules and event statistics use too much vertical space.** Rules are inside a large padded card and the four statistics are rendered as separate large cards with 3xl numbers. Convert rules and counts into compact metadata/metric rows. Avoid repeating information already obvious from the event header.
5. **Roster controls are spread out.** The roster heading, description, and action buttons use a tall responsive header. Keep actions grouped in a compact toolbar and avoid excessive vertical margins.
6. **Roster cards have generous nested spacing.** The outer card uses large padding; party groups use `mt-6 space-y-8`, and party cards use additional padding and slot spacing. Tighten card and section spacing while preserving readable member rows and drag/drop targets.
7. **Raid management adds a second large card per roster.** It renders as a separate full-width panel with generous margins even when no raids exist. Put raid configuration behind a collapsed “Raids” disclosure, showing a compact count/status summary when closed. Keep all existing create/edit/delete/manage-party functionality.
8. **Allocation duplicates navigation.** The header already has an Allocation action, while the page also renders a large Allocation section and empty-state card. Keep allocation accessible, but reduce the section to a compact status row or collapsed disclosure; do not remove access to existing runs.
9. **Event header has room to tighten.** Reduce excess top spacing and simplify action labels/sizing. Preserve event type, date/time, guild identity and the important actions (send attendance prompt, allocation, refresh).

### Recommended page hierarchy

- **Compact event header:** event type + date/time + guild; small action toolbar. No back button.
- **Event metadata strip:** compact event rules and member/availability/roster counts.
- **Attendance:** compact response buttons and count strip; member response list remains expandable.
- **Rosters (primary content):** compact heading/action toolbar; roster summary headers; keep the currently active/first roster visible and allow other rosters to collapse; tighten party/battlefield spacing without shrinking touch targets.
- **Raids:** collapsed configuration disclosure per roster.
- **Allocation:** compact status/disclosure.
- **Event results:** collapsed by default and placed after roster operations.

### Implementation constraints

- UI/layout only unless a defect is discovered; do not change event, attendance, roster, allocation, raid, or resource-pool business logic.
- Preserve all permission gates, loading/error states, polling/refresh behavior, attendance lock behavior, and mobile responsiveness.
- Preserve the compact resource-pool selector introduced in PR #185 inside Event Rules, but reposition it naturally within the compact metadata area if needed.
- Keep the roster editing interactions and slot targets usable on touch devices.
- No database migration expected.
- Validate with TypeScript, lint on changed files, tests, and production build. Do not merge/deploy until checks pass and the user approves the release.

### Next task

Implement the hierarchy above in a focused UI PR, starting with removal of all three back links, moving/collapsing Event Results, compacting attendance/rules/metrics, and then reducing roster/raid/allocation vertical density. Update this audit after implementation and report any trade-offs.

---

## Platform / production progress — 2026-11-28

**Current production branch:** `main`  
**Latest confirmed application merge:** PR #185, merge commit `4c7572232a23d46db8b29b7944b8bc05b1a656a2`.  
**Production URL:** `https://hmdl.vercel.app`

### Completed since the previous status update

- **PR #184 — Security remediation** merged to `main` as `347671b55e6207b51e9ae3d23b069c665c984cb4`. CI and CodeQL passed. Remediated security audit findings #2–#8: subscription expiry/read-only enforcement, session revocation, Discord interaction freshness and replay protection, OCR rate/concurrency controls, upload/body/image hardening, configured APP_URL logout redirects, and security CI coverage.
- **Security finding #1 — Discord guild ownership verification — remains intentionally unmodified**, per explicit instruction. Do not change it unless separately authorized.
- **Production database migrations applied:** after updating the local checkout to include the PR #184 migrations, Prisma reported three pending migrations: `20261128010000_add_session_revocation_version`, `20261128020000_add_discord_interaction_replay_receipts`, and `20261128030000_add_rate_limit_buckets`. The user ran `prisma migrate deploy` against the production Railway database and confirmed the site works. No further migration is required for PR #185.
- **PR #185 — Compact event resource pool selector** merged to `main` as `4c7572232a23d46db8b29b7944b8bc05b1a656a2`. Replaced the full-width top resource-pool bar on `/events/[eventId]` with a compact button inside Event Rules; selector and Save action expand on demand. Existing event-type linking, lock protection, and no-pool/configuration messaging are retained. UI-only; no migration.
- **Automation:** the hourly PR #185 CI/CodeQL watcher was disabled after the PR completed. It must not be restarted.

### Current production / validation state

- User confirmed production recovered and works after the three PR #184 migrations were deployed.
- PR #185 was merged after CI and CodeQL succeeded.
- The Vercel production deployment for PR #185 was reported as pending immediately after merge. **Do not mark the deployment as verified until the live deployment reports Ready and a production smoke test succeeds.**
- No live-game damage validation is available; this remains separate from production web-app validation.

### Outstanding issues and security follow-ups

1. Verify the latest Vercel production deployment for merge commit `4c7572232a23d46db8b29b7944b8bc05b1a656a2` is Ready, then smoke-test login/session behavior, guild pages, event detail, and the compact resource-pool selector (including locked-event behavior).
2. Complete manual security verification / penetration testing for the PR #184 changes, especially subscription read-only enforcement, session invalidation, Discord interaction replay rejection, OCR/upload limits, and logout redirect handling.
3. Review long-term cleanup/retention for `RateLimitBucket` rows; accumulation was identified as a low-priority operational follow-up.
4. Review Discord interaction receipt retry semantics: a receipt created before downstream handling may prevent replay of that same interaction if handling subsequently fails; retry should use a newly generated interaction.
5. Consider a Stripe webhook event-receipt/idempotency table. Current operations are largely idempotent, but duplicate events can repeat Discord role synchronization.
6. Keep the explicit exception for security finding #1. Do not include it in automated remediation batches.

### Next steps — ordered

1. **Production release verification:** confirm Vercel Ready for the PR #185 merge, then perform the smoke tests above. Record the deployment URL/ID and result here.
2. **Security close-out:** perform manual security/penetration checks for findings #2–#8; log any concrete defects as separate fixes. Do not touch finding #1.
3. **Resume the native RO3 combat simulator migration** using the existing PR #144 status and parity gates below. The production iframe must remain unchanged until equivalence evidence is reviewed and the user explicitly approves cutover.
4. **Revisit deferred backlog only after the above:** rate-limit retention cleanup and Stripe webhook event idempotency. Do not treat these as blockers for the already merged UI change.

### Recent PR references

- [PR #184 — Security remediation](https://github.com/tengdawei35-beep/rooc-guild-suite/pull/184) — merged.
- [PR #185 — Compact event resource pool selector](https://github.com/tengdawei35-beep/rooc-guild-suite/pull/185) — merged.
- [PR #144 — Native combat simulator migration](https://github.com/tengdawei35-beep/rooc-guild-suite/pull/144) — draft; not merged.

---

## Current focus: RO3 Combat Simulator — iframe to native React

**Status:** Active migration in progress; native preview exists. Production remains on the legacy iframe.

**Repository:** `tengdawei35-beep/rooc-guild-suite`  
**Active implementation PR:** [#144 — Extract RO3 combat engine for native React migration](https://github.com/tengdawei35-beep/rooc-guild-suite/pull/144)

### Product and engineering decisions

- The embedded Heimdall RO3 damage simulator is the authoritative calculation model for current RO3 damage-derived calculations, until deliberately superseded.
- Do not rewrite or approximate simulator formulas during migration. Reuse the extracted engine and its data.
- The native implementation is an isolated preview at `/combat-simulator/native-preview`.
- Keep the production iframe and existing route unchanged until native-vs-legacy equivalence tests pass and cutover is explicitly approved.
- Guild member profiles are reference-only. Do not silently map member profile values into attacker/defender simulator inputs.
- Do not claim live-game validation. The game is not live / meaningful live damage samples are unavailable; current checks are software regression tests only.
- Do not publish client-derived `TalentDigest` data in this public repository. The upstream simulator README restricts redistribution; wait for authorized private storage or explicit permission.
- Royal Guard (DPS) is treated as Royal Guard in the combat simulator where the simulator itself only exposes the Royal Guard career. Do not invent a separate simulator career ID.

### Implemented in the native preview / migration branch

- Extracted the legacy calculation engine into a framework-independent ES module and exported the compressed simulator game-data payload through an in-memory adapter.
- Added regression coverage for engine behavior, data loading, skill options, equipment/card catalogs, native build mapping, validation, pet stats, emblem/totem attributes, skill-tree grouping and buff/passive derivation.
- Added Royal Guard base stats, defender controls, career-aware damage skill selection, rotation simulation and damage report.
- Added equipment grids, card sockets and unique/MVP/shadow-card selection behavior, gear rolls, affixes, stunts, refine/enhance caps, two-handed handling and card advancement.
- Added enchantments, resonance, deployed/support pets, passive skills, manual emblem attributes and totem modifiers.
- Added initial season talent controls with a generated-data availability guard.
- Exposed learned skill levels, always-on buff IDs, cycle priority, backswing cancellation, periodic buff settings, start timing and mounted state as simulation inputs and saved-build values.
- Added a career-ancestry skill tree with damage, buff and passive skill levels; supported passive IDs and long-duration buffs are derived from selected skills.
- Added guarded legacy build import for distinct attribute pipelines, pet collection pairs, Echo rolled attributes, deployed totems, attacker element, Bond/boss bonus, talent profession mode and Monte Carlo settings.
- Added versioned browser-local native saved builds (up to eight).
- Added three simulator-authored Royal Guard candidate rotation presets; manual rotations remain editable.
- Replaced the raw cast-log dump with structured report events and sample damage events.
- Native Monte Carlo report uses the simulator's seeded distribution engine and includes distribution KPIs, per-skill hit/crit/share, total-damage histogram, mean-DPS-over-time chart, cast timeline, a sample trial, per-skill normal/critical histograms and a named pinned-baseline A/B comparison (sequential in-memory workflow).

### Latest progress — 2026-11-26

- Audited the legacy v15 simulator currentBuild(), autoBuffs() and simBuild() behavior against the native skill-tree adapter.
- Added a named saved-build A/B comparison flow to PR #144. Run Build A, pin it as the baseline, load and run Build B; the report labels the baseline build and shows its trial count/duration plus mean, p5 and p95 DPS changes. This is a sequential in-memory comparison, not a batch comparison or cross-device persistence.
- Added a seeded legacy-import report/timeline fixture using the full exported game data. It compares supported imported character stats, skill levels/rotation, totem system enhancement, defender values, duration and seed; it checks deterministic cast logs, sample timelines, Monte Carlo totals, per-skill normal/critical bins and sample trial.
- Expanded the fixture to multiple compatible equipment grids and card sockets, including real catalog-backed affix/stunt IDs and non-empty engine gear/card effects. It now covers a card with non-empty Collection flash attributes, multiple deployed pets and assist pets, resonance, retained talent picks, cyclic rotation and backswing cancellation. The seeded comparison checks character sheets, cast/sample timelines, Monte Carlo totals and per-skill histograms between the native imported build and the legacy-shaped reference input. The reference remains a paired engine-input fixture, not an independently captured iframe output.
- Corrected long-buff classification to match the legacy UI's group-level info.auto rule: group classification is based on the highest-rank row's modeled-effect presence and longest buff tuple duration; only modeled long-duration buffs at the selected learned rank are automatically applied. Regression tests cover mixed modeled/unmodeled durations, zero-ID placeholders and lower-rank duration differences.
- Branch remains synchronized with main (zero commits behind). Latest expanded fixture commits: `051e45ee79230b7795c53bf350a1fab469121fac` (Collection flash/multi-pet coverage), `1763490b9ae9baba4bed3ed0833b7b8a2bdc6bf6` (cyclic rotation/backswing coverage), and `a4bf9abaaf985d8ee42d15e178b4d447ace535f6` (migration documentation).
- Previous full CI [#45788003755](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45788003755) passed all checks. On the expanded fixture, CI [#45805092640](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45805092640) and [#45805317314](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45805317314) passed the complete pipeline: combat regression tests, Prisma generation/migrations, TypeScript, ESLint and production build. The latest Vercel preview status is successful.
- PR #144 remains a draft and is not merged. Production continues to use the legacy iframe.

### Remaining work — ordered next steps

1. **Expand full-build equivalence fixtures.** Multiple gear grids, affixes/stunts, multiple card sockets, Collection flash attributes, multiple pet/assist selections, cyclic rotation and backswing cancellation are now exercised. Remaining fixtures should cover supported non-empty talent/passive effects when authorized data is available and independently captured legacy outputs where a trustworthy source exists.
2. **Complete unsupported legacy import behavior or keep it explicitly reported.** Echo mark colors/procs, dynamic totem procs and overflow totem/support slots remain incomplete. Bonus stat points are preserved but the native stat optimizer is not migrated.
3. **Complete skill/buff parity.** The legacy long-buff group classification now matches; review remaining special-trigger effects, short-duration buff timing and automatic rotation ordering (including always-ready skills). Do not infer unverified effects.
4. **Complete report/timeline parity** across the full supported build surface; document intentional differences and ensure deterministic event ordering, cast counts and distribution summaries remain covered.
5. **Manual preview QA.** Exercise import/export, saved-build A/B comparison, saved builds, skill tree, Royal Guard presets, gear/cards/pets/totems, attacker/defender controls and report interactions at desktop and mobile widths.
6. **Cutover review only after parity.** Present remaining known differences and test evidence; obtain explicit approval before replacing the production iframe.

### Explicitly deferred / blocked

- `TalentDigest` payload import: blocked by upstream redistribution restrictions until authorized private storage or explicit permission.
- Live-game damage validation: deferred until the game and meaningful test data are available. Do not block software migration progress on unavailable live tests.
- Full native cutover: blocked on equivalence evidence and explicit approval.
- Complete Tank/PvP scoring: incoming-damage mechanics are not modeled by the outgoing-damage evaluator; penetration and incoming reductions remain unsupported. Population normalization also waits for meaningful persisted profile data.

### Related workstreams / known state

- PR #142 contains RO3 Tank/PvP score-composition and simulator-backed scoring groundwork. Its synthetic tests are engineering probes, not population calibration. The simulator-backed evaluator requires explicit career/skill IDs and does not fabricate rotations. Royal Guard (DPS) is identified as missing from the simulator's `CLASS_PROFILES` career mapping in that scoring workstream.
- Earlier iframe fixes were tracked in PRs #136 (profile import rendering) and #137 (browser wallet extension errors). Preserve the existing iframe behavior until the native cutover gate is met.

## Handoff protocol for future sessions

At the start of a new implementation session:

1. Read this file first.
2. Inspect the active PR, branch head, latest CI/workflow status and changed files; this file is a handoff, not a substitute for checking GitHub's live state.
3. Reconcile this file against the actual repository and PR. Mark completed items with the commit/PR and validation evidence; do not assume a task is complete from an earlier chat.
4. Continue the first unblocked item in the ordered remaining-work list.
5. After every meaningful implementation batch, update this file in the same PR/branch with: date, completed work, tests/build status, unresolved issues, next exact task, and any user decision required.
6. Never mark production cutover complete without explicit user approval.

## Update log

- **2026-11-26:** Initial project-wide status and handoff file created from the latest available implementation context and PR #144 summary.
- **2026-11-26:** Updated after auditing legacy v15 build fields and preserving the stat-optimizer bonus-point budget; CI passed on `f990735`.
- **2026-11-26:** Added per-skill damage histograms and count-reconciliation regression coverage; CI passed on implementation/test commit `1878394`.
- **2026-11-26:** Added named saved-build A/B comparison metadata, a seeded legacy-import report/timeline parity fixture, and legacy-compatible long-buff group classification. CI passed on `c2e7abc`; see run [#45786847701](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45786847701).

- **2026-11-26:** Extended the seeded full-build fixture to multiple gear grids/card sockets with actual engine-resolved affix and stunt pools; regression tests passed in run [#45805317314](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45805317314) while full CI validation continued. Migration documentation updated in PR #144.

- **2026-11-26:** Added Collection flash, multi-pet/assist and cyclic rotation/backswing coverage to the seeded legacy-import fixture. Run [#45806056154](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45806056154) passed full CI; run [#45806246782](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45806246782) passed combat regression tests, Prisma generation/migrations, TypeScript and ESLint while production build was running. Documentation updated in PR #144.


## Event detail page compact layout — PR #186

**Status:** Implementation opened for review; validation running.  
**Branch:** `ui/compact-event-detail-layout`  
**PR:** https://github.com/tengdawei35-beep/rooc-guild-suite/pull/186

### Implemented

- Removed the `← Events` link from loading, error, and loaded states. The event detail page has no back-navigation control.
- Tightened the event header, event title spacing, and action toolbar.
- Combined event rules and guild/availability/roster counts into a compact metadata strip.
- Reworked attendance into a compact row of response controls and counts. Preserved response locking, own-response state, polling, and expandable/paginated member responses.
- Reduced roster card and battlefield spacing. First roster is expanded by default; additional rosters can be collapsed. Editing automatically expands its roster. Slot rows retain their existing minimum height and interaction targets.
- Changed each roster's raid controls to a collapsed disclosure with raid and unassigned-party counts.
- Changed allocation history to a collapsed disclosure.
- Moved Event Results below roster/allocation operations and collapsed the screenshot uploader/gallery by default.
- No API, business logic, or database schema changes intended.

### Validation

- PR #186 opened against `main`.
- GitHub Actions CI run: `46077771383` — in progress at the time of this update.
- CodeQL run: `46077771409` — in progress at the time of this update.
- Do not merge or deploy until CI/CodeQL pass and the page is reviewed at desktop and mobile widths.

### Review notes

- Verify the compact resource-pool selector from PR #185 remains visible and usable in the Event Rules area on RO3 custom events.
- Verify roster expand/collapse and edit interactions, especially after a roster refresh.
- Verify raid highlighting still locates PartyCard elements after the spacing class changes.
- Verify Event Results upload and image preview interactions inside the disclosure.
- UI-only; no migration expected.

## Casual plan — 2026-11-28

**Branch:** `feat/casual-plan-199`  
**PR:** #193 (draft; do not merge without explicit approval)  
**Price:** USD $1.99/month only. No discounts or alternate billing terms.

### Implemented in this branch
- Casual plan catalog migration adds the plan at 199 cents/month with CORE only.
- Checkout enforces monthly billing and excludes launch and affiliate discounts.
- Casual recruitment accepts character name and job without mandatory stats; stat entry and OCR remain optional.
- Casual ROOC applications skip score calculation, and Casual guilds are excluded from scheduled stat reminders.
- Automatic and preferred roster generation endpoint rejects Casual with `403 PLAN_UPGRADE_REQUIRED`; manual roster creation/editing remains available.
- Applicant review API suppresses ROOC score comparisons for Casual, avoiding misleading zero-valued scores when stats are intentionally omitted.
- Legacy Resource Suite resource creation/update/deletion endpoint is gated through the existing Resource Suite module entitlement check.

### Endpoint audit completed in this branch
- Preferred roster template save endpoint now checks the active guild plan and permits Basic/Total only; Casual receives `403 PLAN_UPGRADE_REQUIRED`.
- ROOC reservations GET/POST/PUT/DELETE now all require the Resource Suite module entitlement, in addition to the ROOC and role checks.
- ROOC allocation history GET now requires the Resource Suite module entitlement.
- Allocation preview, run/commit, reset, rotation audit, audit correction and audit backfill endpoints were inspected; each already enforces Resource Suite entitlement server-side.
- RO3 resource pool configuration and RO3 opt-in GET/POST endpoints were inspected; both already enforce Resource Suite entitlement server-side.
- Event RO3 resource-type linking endpoint was inspected; it already enforces Resource Suite entitlement server-side.
- Legacy resource create/update/delete endpoint was inspected; it already enforces Resource Suite entitlement server-side.

### Still required before production activation
- Verify all Casual feature-matrix restrictions and UI upgrade messaging, including any indirect entry points to preferred roster actions.
- Verify Basic and Total behavior remains unchanged.
- Audit remaining billing edge cases and verify the plan migration against schema constraints.
- Complete CI, CodeQL, tests, and production build validation.
- User must configure the Stripe Casual monthly Price ID before checkout can be activated.
- Do not apply the migration to production or change Stripe environment variables without explicit authorization.

### Latest changes
- `b330aca`: enforce Basic-tier access for automatic/preferred roster generation.
- `ac4959c`: suppress applicant comparisons for Casual guilds.
- `976b10e` and `1600ac2`: fix Casual application subscription lookup and skip ROOC scoring for stat-optional Casual applicants.
- `8ee8561`: initial preferred-roster endpoint gate; corrected immediately in `4fc8e62` to check Basic/Total plan entitlement rather than Resource Suite module entitlement.
- `d30c085`: gate all ROOC reservation operations behind Resource Suite entitlement.
- `b3ef6f0`: gate allocation history behind Resource Suite entitlement.
- Latest CI run `46127751453` and CodeQL run `46127751552` are in progress on `4fc8e62`.
