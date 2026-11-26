# Heimdall Project Status

_Last updated: 2026-11-26 (Asia/Kuala_Lumpur)_

This is the project-wide handoff file. Update it whenever implementation work advances, a decision changes, a validation run completes, or work is paused. Keep it concise enough to scan, but specific enough that a new ChatGPT conversation can resume without relying on chat history.

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
- Expanded the fixture to use actual exported equipment and card catalogs with multiple compatible equipment grids and card sockets. It selects actual affix/stunt IDs from each chosen item's engine-resolved pools, maps the values through the native equipment adapter, and asserts non-empty gear attributes, stunt effects and card attributes. The real exported pet/assist-pet growth, resonance and talent-level settings remain in the seeded report comparison. The test checks identical character sheets, cast/sample timelines, Monte Carlo totals and per-skill histograms between the native imported build and the legacy-shaped reference input. The reference remains a paired engine-input fixture, not an independently captured iframe output.
- Corrected long-buff classification to match the legacy UI's group-level info.auto rule: group classification is based on the highest-rank row's modeled-effect presence and longest buff tuple duration; only modeled long-duration buffs at the selected learned rank are automatically applied. Regression tests cover mixed modeled/unmodeled durations, zero-ID placeholders and lower-rank duration differences.
- Branch remains synchronized with main (zero commits behind). Latest expanded fixture commits: `7265896d06169112fbabfb07716e6350fc8a37ae` (multi-slot gear/card fixture) and `1a937d53d5ff1d8b368ae04d88e0c854a6c49f44` (migration documentation).
- Previous full CI [#45788003755](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45788003755) passed all checks. On the expanded fixture, CI [#45805092640](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45805092640) and [#45805317314](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45805317314) passed the complete pipeline: combat regression tests, Prisma generation/migrations, TypeScript, ESLint and production build. The latest Vercel preview status is successful.
- PR #144 remains a draft and is not merged. Production continues to use the legacy iframe.

### Remaining work — ordered next steps

1. **Expand full-build equivalence fixtures.** Multiple equipment grids, multiple card sockets, catalog-backed affixes/stunts and engine effects are now exercised. Remaining fixtures should cover card Collection flash effects, supported non-empty talent/passive effects, additional pet/assist combinations and independently captured legacy outputs where a trustworthy source is available.
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
