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
- Native Monte Carlo report uses the simulator's seeded distribution engine and includes distribution KPIs, per-skill hit/crit/share, total-damage histogram, mean-DPS-over-time chart, cast timeline, a sample trial and pinned-snapshot DPS comparisons (as described in PR #144).

### Latest progress — 2026-11-26

- Inspected the current v15 legacy simulator `currentBuild()` adapter and added a field-by-field source-to-native import inventory in `docs/ro3-combat-simulator-native-migration.md` on PR #144.
- Preserved legacy `bonusPoints` as `bonusStatPoints` through import, native draft storage/load, and the engine build object. It is retained for future optimizer parity but does not affect the current fixed-stat damage simulation.
- Added importer regression coverage for explicit bonus-point values and the legacy default adjustment, plus backward compatibility coverage for older browser-local native saved builds that predate this field.
- Latest implementation commit: `f9907357092b13ee3f4524e320a20a907edca704` on `feat/combat-simulator-native-react-migration`.
- CI run [#45782943763](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45782943763) completed successfully on commit `f990735`; combat tests, Prisma generation/migrations, TypeScript, ESLint and production build all passed. Vercel preview was successful.
- Added per-skill normal-hit and critical-hit damage histograms for the top six damage skills, consuming the extracted engine's existing `normalBins` / `critBins` arrays. Added tests reconciling histogram counts to hit/crit totals. Latest code/docs commits: `d041f49` and `b823970`; CI run [#45783407593](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45783407593) was running at the last check; Vercel preview status was successful.

### Remaining work — ordered next steps

1. **Finish legacy build import parity.** Field inventory is now documented; continue with representative full legacy-vs-native fixtures and investigate remaining source state. Known gaps include Echo mark colors/procs, dynamic totem procs, and explicitly reported unsupported/overflow state.
2. **Complete native skill/buff behavior parity.** Review remaining special-trigger effects and short-duration buff scheduling. Keep unsupported behavior explicit; do not infer mechanics.
3. **Strengthen equivalence fixtures.** Add saved-build-to-saved-build comparisons, per-skill hit histograms, and representative full legacy-vs-native report/timeline fixtures using identical inputs. Include seeded Monte Carlo determinism and compare event ordering, cast counts, damage distribution and DPS summaries.
4. **Complete report/timeline parity.** Align the native report and timeline with the legacy simulator for the supported input surface; document intentional differences.
5. **Re-run full CI on the latest PR head.** Validate combat regression tests, Prisma generation/migrations, TypeScript, ESLint and production build. Earlier CI pass on commit `1eedd1b` is not sufficient evidence for later commits; PR #144 notes subsequent changes were being revalidated.
6. **Manual preview QA.** Exercise import/export, saved builds, skill tree, Royal Guard presets, gear/cards/pets/totems, attacker/defender controls and report interactions at desktop and mobile widths.
7. **Cutover review only after parity.** Present remaining known differences and test evidence; obtain explicit approval before replacing the production iframe.

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
- **2026-11-26:** Added per-skill damage histograms and count-reconciliation regression coverage; latest CI run pending.
