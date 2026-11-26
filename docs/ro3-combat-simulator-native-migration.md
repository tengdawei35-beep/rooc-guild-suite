# RO3 Combat Simulator — native React migration

## Migration guardrails

- Keep the existing iframe implementation operational until the native implementation passes regression/equivalence checks.
- Preserve the current calculation formulas and rounding behaviour. Formula changes require a separate, explicit review.
- Do not treat simulator output as verified live-game damage. The game is not live; current checks are software regression checks only.
- Keep the calculation engine independent of React, DOM APIs, and application routing.
- Preserve the upstream community-project attribution in the product and source.

## Phase 2 — engine extraction

The calculation region marked `@@ENGINE-BEGIN` / `@@ENGINE-END` in
`src/lib/ro3-combat-simulator/ro3-damage-sim.html` has been extracted to:

`src/lib/ro3-combat-simulator/engine/ro3-damage-engine.mjs`

The extracted module retains the source implementation, including its fallback data tables,
stat pipeline, skill parameter rules, damage evaluation, rotation simulation, optimizer,
and talent helpers. The extraction removes only the HTML marker comments and adds a
module header; calculation code has not been intentionally rewritten.

A regression test suite is available via:

`npm run test:combat-engine`

It covers module import, fallback data access, stat-point calculations, the attribute
calculation pipeline, decompression of the full embedded export, and construction of the
in-memory data store with the expected career/skill records. These are software regression
checks, not live-game validation and not yet full simulator equivalence tests.

## Important remaining extraction work

The HTML still contains the original UI and its embedded exported game-data payload. The
native implementation must next separate that payload into a typed, versioned data module
and provide it to `Ro3MemoryDataStore`. Do not silently fall back to the smaller built-in
tables when the full embedded payload is expected.

The existing UI's state conversion, saved-build migration, profile import, target editing,
skill rotation, reports, and chart/timeline rendering remain in the HTML. They have not
been migrated in this phase.

## Current status

| Phase | Status |
| --- | --- |
| Architecture audit | Complete |
| Extract calculation engine | Initial extraction complete; smoke tests added |
| Extract embedded game data | Complete; compressed payload module and in-memory store factory added |
| Define typed engine inputs/outputs and expand coverage | Initial typed build/defender/rotation boundaries; broader engine typings and report contracts still pending |
| Typed workspace models and calculation adapter | Initial boundary complete |
| React engine lifecycle hook | Initial hook complete; not connected to production route |
| Build native React component architecture | Isolated React preview, attacker/defender panels, editable Royal Guard build, local saved builds and structured report added; full feature parity pending |
| Connect React state to extracted engine | Royal Guard base stats, equipment/cards, affixes/stunts, pets, enchantments, manual emblem/totem inputs, resonance, talent/passive inputs and defender configuration are wired; authoritative TalentDigest and full build-source parity pending |
| Migrate profile import and reports | Guild profiles remain reference-only; native preview uses the legacy seeded Monte Carlo engine and shows distribution KPIs, per-skill breakdown, total-damage and damage-over-time charts, cast/sample timelines and pinned-snapshot DPS comparison; saved-build comparisons and full report equivalence remain pending |
| Regression/equivalence tests against current iframe | Legacy attribute-source/simulation fixture and seeded Monte Carlo determinism test added; full damage/report/timeline parity remains outstanding |
| Remove iframe and legacy message bridge | Blocked until equivalence passes |

The authenticated iframe route remains the production path throughout this work.


## Native preview checkpoint

An authenticated, subscription-gated preview is available at `/combat-simulator/native-preview` on the migration branch. It loads the extracted engine/data through the React lifecycle hook and reads the same active-guild member profile API as the legacy workspace. Attacker and defender selections are displayed in native panels for profile-contract verification. The preview also runs an isolated Royal Guard simulation using editable native inputs. `/combat-simulator` continues to use the existing iframe; the preview is not a full feature-parity or equivalence claim.


### Native baseline simulation checkpoint

The isolated preview now exposes a deliberately small, explicit baseline build: the existing Royal Guard career ID (1410), six base stats, defender level/P.DEF/M.DEF/element/race/size IDs, optional SkillConfig IDs in rotation order, and simulation duration. It calls the extracted `simulateRotation` through the existing React hook and displays expected damage, sustained DPS, burst-5s DPS, cast counts and cast log. Empty skill rotation uses the engine's normal attack fallback. Guild profiles remain reference-only until their stored stat schema can be mapped without guessing. This is a native-engine smoke workflow, not a complete migration or an equivalence claim.

### Career-aware equipment and card catalog foundation

Added `equipment-options.ts` as a data-only adapter over the exported `ItemConfig` and `EquipConfig` tables. It mirrors the legacy simulator's seven equipment grids, career ancestry restrictions, equipment part/tier mapping, card part/quality ordering, and all 18 card sockets with their unlock levels. The adapter exposes catalog metadata and feeds the typed native build state. Regression tests cover job filtering, tier lookup, card naming, socket definitions and native-to-engine mapping. Full data-backed legacy equivalence fixtures remain outstanding.

### Native equipment and card build integration

The isolated React preview now exposes the seven equipment grids and all 18 card sockets using the exported game-data catalogs. Equipment choices are filtered by Royal Guard's career ancestry, slot compatibility and the character's current level. The native selection adapter maps chosen items to the existing engine's `gear` and `cards` inputs; no damage formulas were changed. Basic refine/enhance levels, gear roll position (0–10000), card star/level, and the Collection/flash toggle are editable. Equipment and card socket level restrictions are enforced in both the UI and the native-to-engine adapter. The resulting character sheet displays P.ATK, M.ATK, P.DEF, M.DEF, HIT and CRIT. Selected equipment and cards are passed into both `buildCharacterStats` and the native damage simulation.

The native preview now supports gear affix selection, random stunt selection, fixed-stunt display, two-handed off-hand grid levels, and the Collection/flash input. The remaining gap is full data-backed equivalence coverage for these combinations and other legacy build sources. No parity claim is made for the full build. Production remains on the iframe until full build and report equivalence are demonstrated.


### Legacy build import field coverage (v15)

The legacy simulator's `currentBuild()` adapter exposes the following calculation inputs. The native importer maps the supported values without re-deriving formulas:

| Legacy source | Native destination | Status / limitation |
| --- | --- | --- |
| `job`, `level`, `stats`, `element` | Royal Guard gate, `level`, `stats`, `attackerElement` | Imported; only career 1410 is accepted. |
| `bonusPoints` | `bonusStatPoints` on native draft and engine build | Preserved exactly for the future stat optimizer; it does not alter the current fixed-stat damage simulation. |
| `ex` | `extraAttrInput` → `equipmentAttrs` | Imported as flat/pre-conversion attributes. |
| `bonus.boss` | `bondBonusBp` | Imported using the legacy percent-to-basis-point conversion. |
| `res` | `resonanceRefine`, `resonanceEnhance` | Imported. |
| `gear`, `cards`, `pets`, `assist` | Native equipment, deployed pets and three support slots | Imported within native slot limits; overflow support-pet slots are reported. |
| `petCollect` | `petCollectionAttrInput` → `extraAttrs` | Imported. |
| `echoes[].stats` / `echoAttrs` | `emblemAttrInput` → `emblemAttrs` | Rolled/manual attributes imported; Echo item/level/color mark effects are not modeled. |
| `totems`, `totemLv` | `totemLoadoutInput`, `totemLevel` | Up to three totems and supported attributes/skills imported; dynamic totem procs remain incomplete. |
| `skills`, `rotation`, `disabledRotation` | learned skill levels, rotation row IDs and disabled row IDs | Mapped only where a supported SkillConfig row exists. |
| `talents.lv`, `talents.picks`, profession / any-profession | Native talent controls | Values retained; effects are inactive while authorized TalentDigest data is unavailable. |
| `sim.seconds`, `runs`, `seed`, `cycle`, `cancel`, `howl` | Duration, Monte Carlo settings, cycle, backswing, periodic-buff and mounted controls | Imported through the native control mapping. |
| `target` | Defender level, P.DEF, M.DEF, element, race and size | Imported. |
| `hold`, `holdSrc` | No direct native control | Current solved flat values in `ex` are imported; editable hold/final-stat targets are not preserved as active native optimizer targets. |
| `echoes[].colors` | No native destination | Explicitly unsupported: Echo mark/proc effects are not modeled. Original legacy tabs remain in legacy local storage. |
| `totems[].snapshotRef`, dynamic proc state | No native destination | Snapshot references and dynamic proc scheduling are not migrated. |
| Additional totem/support slots | No native destination | Overflow is reported, never silently treated as supported. |

This inventory describes the source adapter's exposed build shape, not a claim that every legacy UI display field is a simulator input. Fields not listed as supported remain outside native calculations until separately verified.

### Native gear affixes, stunts and two-handed weapon handling

The native preview now reads each selected item's affix pool, slot count, fixed stunts, random stunt pools and roll chances through the extracted engine's existing `gearParts()` breakdown. The UI exposes up to the available number of affix slots (maximum two in the current interface), each item's own stunt pools and the fixed stunts as read-only metadata. Selected affix and stunt IDs are passed unchanged to `buildCharacterStats()` through the existing gear input contract; the engine retains its original roll-value and effect calculations.

Two-handed weapons (the simulator's weapon part 1) now expose separate off-hand-grid Refine and Enhance values. The UI prevents simultaneously selecting an off-hand item and a two-handed weapon. The adapter maps off-hand levels onto the two-handed weapon input so the existing engine can account for the off-hand grid's Max HP contribution.

The new regression coverage inspects the full exported data for an equipment row with affix or stunt configuration and verifies the engine breakdown exposes its corresponding pools. Build-input tests also assert affix, stunt and off-hand level values survive the native-to-engine mapping. This remains software-level coverage; no live-game damage validation or complete native-versus-legacy equivalence claim is made.


### Base-level equipment and card cap parity

The legacy UI derives each grid's maximum Refine and Enhance from `RefiningTable` and `StrengthenTable` `_iLev` requirements. The native hook now calculates those same seven per-grid caps from the exported tables, displays them as input maxima, and clamps mapped values before simulation. A two-handed weapon's off-hand grid levels use grid 2's own caps.

Card advancement now follows the legacy `CARD_CAP` values (star 0–3: levels 5, 10, 15, 15). The native UI also queries the existing `cardParts()` breakdown to determine whether a selected card actually has Collection attributes; the Collection toggle is disabled when it does not. The adapter clamps card level to the selected star's cap. Tests cover gear cap mapping and card star-level clamping.

## Native character-source inputs (current preview)

- Deployed pet slots (primary plus utility slots) are selected from exported `PetDigest` data. Pet level, star and stage are passed to the existing pet attribute and combat-effect functions.
- Support-pet slots use the matching `PetGrowth` identifiers and the existing support-pet stat-share calculation.
- Pet stat mapping has a full-data regression test that checks deterministic output from the legacy `petStats` function.
- Season talent level, profession and branch/cluster/talent picks are exposed through the existing `talentOptions`, `talentWalk` and `talentEffects` functions.
- Passive SkillConfig row IDs can be supplied to the existing passive attribute pipeline.
- Talent skill-level prerequisites are exposed as editable `groupId:level` pairs and passed into the existing talent effects calculation.
- Enchantment attributes and refine/enhance resonance are included in both the sheet and damage build inputs.

These inputs remain part of the gated native preview. They do not change the production iframe or imply live-game verification.

- Emblem attribute pairs and deployed totem inputs are now wired into the existing engine. The native preview accepts exact attribute ID/value pairs, totem skill IDs and enhancement basis points; this is intentionally a manual bridge until the full emblem/totem catalogs and editor UX are migrated.
- A regression test verifies emblem attributes and enhanced totem attributes flow through the existing character sheet pipeline without changing formulas.
- Talent configuration depends on the generated `TalentDigest` data row. If that row is absent from the exported dataset, the current talent controls correctly show no available branches; generating the digest from the season talent source tables remains a required parity task before treating the talent editor as complete.

### Authoritative Season TalentDigest import

The authoritative digest-generation logic lives in the upstream [RO3 damage simulator](https://github.com/hksekai/ro3-damage-sim), in `build-ro3-sim.mjs`. It derives `TalentDigest` from the client's SeasonTalentTreeConfig, SeasonTalentConfig, SeasonTalentEffectConfig, LC_ConditionList, SpecialEffectConfig, BuffConfig, ItemConfig and localization tables.

Heimdall now includes `scripts/import-ro3-talent-digest.mjs`. It imports the already-generated `TalentDigest` row from the upstream simulator's `ro3-damage-sim.html` data payload and copies any talent-referenced BuffConfig rows that are not already present. This deliberately reuses the upstream generator's output rather than maintaining a second implementation of the game-data transformation.

Run it from the Heimdall repository root after obtaining the current source simulator HTML:

```bash
node scripts/import-ro3-talent-digest.mjs --source-html /path/to/ro3-damage-sim.html
```

The importer validates the source digest and every referenced buff, updates only the native compressed game-data payload, and preserves the other native tables and UI metadata. It fails closed if the source digest or a referenced buff is missing. Unit tests cover extraction, merging, buff completeness, compressed-payload round trips and invalid source data.

The import must still be run with the current upstream HTML before the talent editor can be considered data-complete. The importer and its tests are now part of the migration branch; this commit does not fabricate or claim to have populated the live digest.

**Data-handling restriction:** the upstream simulator README explicitly says its client-derived game data should remain in a private repository and not be redistributed outside the community. Heimdall's repository is currently public. Therefore, do not run this importer and commit the resulting client-derived digest/buff rows to this public repository unless the upstream maintainer grants permission or the repository is made private. The importer is implemented and tested, but the data import is intentionally held pending an appropriate private/authorized destination.

### Native saved builds (local preview)

The native React preview now supports a versioned, browser-local saved-build collection (up to eight entries). It stores the editable native inputs for the Royal Guard build: base stats, equipment/cards, pets, enchantments, emblems/totems, resonance, talents/passives, defender settings and skill rotation. Loading a saved build restores those inputs and clears the previous simulation report so stale results are not mistaken for the newly loaded setup.

The storage format is versioned at `hmdl.ro3.native-builds.v1`, validates restored values, deduplicates IDs and safely ignores malformed or unsupported entries. Guild profile selections and simulation output are intentionally excluded. These native saved builds are local to the current browser; they are not synced across devices or stored in the guild database.

This is the first native persistence layer, not a complete legacy-tab migration. The legacy iframe uses its own `ro3sim.builds.v1` state with broader class, skill, target and simulation settings. Importing those tabs remains gated on full field-by-field mapping and explicit reporting of any unsupported values; the migration must not silently discard typed attributes, rotations or advanced systems.

### Rotation and automatic buff parity checkpoint

The native catalog follows the legacy simulator's modeled-effect whitelist for always-on buffs: supported attribute changes, supported skill-parameter changes, and known modeled proc families. Long-buff group classification now mirrors the legacy UI's info.auto rule: the highest-rank row must contain a modeled buff effect and its longest buff tuple must be at least 60 seconds (including duration tuples whose buff ID is zero). When a group is classified as automatic, only modeled buff rows at the selected learned rank with a duration of at least 60 seconds are applied. Short modeled buff skills are included in the rotation picker rather than treated as permanent buffs. Mounted riding-family passive buffs are derived from learned skill level when the mounted toggle is enabled. Regression coverage includes mixed modeled/unmodeled durations, zero-ID placeholders and differences between lower-rank and highest-rank durations.

The rotation input preserves cast priority and repeated SkillConfig IDs (needed by cycle mode). A separate disabled-ID list skips selected skills without deleting them from the saved priority sequence. The native preview now provides an ordered rotation editor with move-up/move-down controls, duplicate entries, per-skill enable/disable toggles and removal. The Royal Guard preview now exposes the three candidate rotations defined by the extracted engine's `CLASS_PROFILES.royalguard` and maps preset skill groups to the native career catalog's highest learnable SkillConfig rows where available. Applying a preset replaces the current rotation and clears disabled-ID overrides. Exact legacy ordering heuristics (including automatic placement of always-ready skills) remain outstanding.

### Native learned-skill tree checkpoint

The Royal Guard native preview now builds a learned-skill catalog from the selected career ancestry and exposes level selectors for learnable damage, buff and passive skills. Selected passive rows are converted into the engine's passive skill row IDs. Learned buff skills are inspected at their selected rank; supported buffs with at least 60 seconds' duration and relevant attribute/skill modifiers are automatically included as always-on buffs. Talent-granted buffs are also included automatically.

This reproduces a defined subset of the legacy iframe's skill-state derivation. The native catalog uses the extracted engine's modeled attribute/skill-effect whitelist and known proc families, with regression coverage for long buffs, short buffs and mounted riding-family passives. Special triggered-buff classification, short-duration buff scheduling, and class-specific skill UI/rotation logic still need broader parity coverage. Manual buff IDs remain available as an override. The feature is not yet evidence of complete legacy skill-tree parity.

### Native combat-option coverage checkpoint

The preview now exposes additional simulation controls already supported by the extracted engine: learned skill levels keyed by SkillConfig group ID, explicit always-on BuffConfig IDs, cycle-priority rotation, backswing cancellation, periodic-buff enable/disable and start timing, and mounted state. These are passed to the actual simulation build and are persisted in native saved builds.

This is still an explicit-input bridge, not full legacy skill-state parity. The iframe derives learned levels, passive skills, auto-cast long buffs, talent-granted buffs, rotation ordering and mounted/howl behaviour from its complete skill-tree and simulation state. The native preview does not yet reproduce that entire derivation automatically. Until the native skill editor and auto-buff derivation are implemented, users must supply group levels and buff IDs explicitly; unsupported or omitted legacy state must not be treated as equivalent.

### Native report presentation checkpoint

- Replaced the raw JSON cast-log dump with a structured, collapsible event list showing time, event type, name, hit count and lock/duration where supplied by the engine.
- Added a separate sample-damage-events list from the engine's sampled timeline, showing impact time, skill and expected damage.
- The native report now uses the engine's seeded `simulateDistribution` Monte Carlo path (default 3,000 trials, editable run count and seed), not just the deterministic expected-value rotation. It shows mean/median/p5/p95, standard deviation, mean DPS, expected damage, burst DPS, per-skill hit/crit/share breakdown, total-damage distribution and mean-DPS-over-time charts, deterministic cast timeline and one rolled sample trial. Pinned snapshot DPS comparisons are available; saved-build-to-saved-build comparison, per-skill hit histograms and full distribution/timeline equivalence are still outstanding.
- The preview now explicitly reports when the generated `TalentDigest` is absent. In that case, talent picks do not affect the result; the source-table digest generation is still outstanding.


### Legacy tab import checkpoint

The native preview now includes an explicit **Import legacy tabs** action. It reads the iframe's same-origin `ro3sim.builds.v1` browser-local tab book (or the older single-build `ro3sim.v1` key when no tab book exists), validates the source, and imports only current schema v15 Royal Guard (career 1410) tabs. It maps base stats, supported gear/card slots, pets, support-pet growth, learned skill levels, rotation order/disabled skills, talent picks, resonance, simulation timing and defender fields into native saved builds. Legacy `ex` bonuses map to native `equipmentAttrs` (before attribute conversions), while pet-collection pairs map separately to `extraAttrs`; Echo rolled attributes are mapped into `emblemAttrs`; and up to three deployed totems (IDs, rolled attributes, selected skills and system enhancement level) are preserved in the native attacker input. When a pre-level-control legacy tab stores only a totem enhancement value, the importer resolves it back to the matching `TotemLvConfig` level.

The importer intentionally rejects other careers and legacy state versions that have not first been upgraded by the iframe. It reports unsupported state rather than silently discarding it: Echo mark colors and their mark/proc effects are not imported; dynamic totem procs are not fully modeled; and totem slots beyond the three native slots are omitted. Legacy `ex` flat/typed attribute bonuses are transferred to the native engine's `equipmentAttrs` pipeline (before attribute conversions), while pet-collection attribute pairs remain in `extraAttrs`; Echo rolled attributes use the `emblemAttrs` pipeline. The legacy `hold` targets are not retained as editable targets; their currently solved flat bonuses are represented by the imported `ex` values. Legacy bonus stat points remain unused because the native stat optimizer has not yet been migrated. Talent selections and the legacy any-profession mode are imported; effects remain inactive when the authorized TalentDigest is unavailable. Imported builds are saved in the native browser-local collection; the original legacy tabs are not modified or deleted.

This is a guarded first-pass migration path, not complete legacy parity. Broader field mapping and preservation of unsupported values remain required before iframe retirement.


### Per-skill damage histogram checkpoint

The native report now visualizes the simulator distribution engine's existing per-skill normal-hit and critical-hit damage bins for the six highest-damage skills. The UI consumes the engine's `normalBins`, `critBins`, `lo` and `hi` output directly; it does not recalculate damage or invent bin values. Regression coverage asserts each histogram's counts reconcile exactly to the engine's normal-hit and critical-hit totals.


### Saved-build A/B comparison and seeded report fixture

The native report supports a sequential saved-build comparison using the existing pinned baseline control: run a saved Build A, pin its result, load and run Build B, then compare mean, p5 and p95 DPS. The report identifies the baseline by its build name and displays its trial count and simulation duration. The pinned result exists only in the current browser session; it is not a persisted saved-build comparison record or a batch runner.

A seeded legacy-import regression fixture now loads the full exported simulator tables and compares a supported imported Royal Guard build with a legacy-reference build using the same attacker inputs, learned skill levels, rotation, totem system enhancement, defender, duration and random seed. It compares deterministic cast logs, sample damage timelines, Monte Carlo total-damage trials, per-skill normal/critical histograms and the captured sample trial. This is software equivalence coverage for the explicitly mapped fixture surface, not independent live-game validation or proof of full legacy UI parity.


### Expanded full-build import fixture (2026-11-26)

The seeded legacy-import fixture now selects a real Royal Guard-compatible equipment row and card from the exported catalogs, then imports non-default roll/refine/enhance and card star/level values through the v15 importer. It also includes a real PetDigest entry and its growth ID for the active pet and assist-pet selections, plus non-zero resonance and talent-level settings.

The test asserts that the imported native draft retains the source equipment/card IDs and values, then maps those selections through the same catalog adapter used by the React preview. It compares the resulting native build and legacy-reference build character sheets and seeded simulation reports. CI run [#45788003755](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45788003755) passed the combat regression suite, Prisma generation/migrations, TypeScript, ESLint and production build; the Vercel preview also succeeded.

This broadens the tested surface but does not yet establish parity for all seven gear slots, affix/stunt combinations, card collection effects, non-empty talent picks, all pet combinations, special procs or independently captured legacy outputs.

### Multi-slot gear, affix/stunt and card-socket fixture (2026-11-26)

The seeded import fixture has been extended beyond a single weapon and card. It now chooses compatible exported catalog items across multiple equipment grids and multiple card sockets. It resolves each selected item's actual random-affix and stunt pools through the extracted engine's `gearParts()`, imports the selected affix/stunt IDs, maps the build through `toEngineEquipment()`, and verifies that the resulting selections contribute non-empty engine gear/card attributes and gear stunt effects. The character-sheet and seeded report comparisons still run on the expanded build.

This is a stronger engine-path regression fixture for the selected data-backed combinations. It is not an independent snapshot of the legacy iframe's rendered output; the reference build remains a separately constructed legacy-shaped input to the same extracted engine. Card Collection flash attributes, broader talent effects and additional pet variants still need dedicated fixtures where supported data can be used without violating the upstream TalentDigest redistribution restriction.

### Collection cards, pet combinations and rotation controls (2026-11-26)

The expanded seeded fixture now selects a catalog-backed card with non-empty Collection flash attributes and asserts those attributes flow through the engine's `cardParts()` / `cardEffects()` pipeline. It also imports multiple exported PetDigest entries into deployed-pet and assist-pet selections and asserts the imported build retains both selections. The seeded report parity fixture now enables cyclic skill priority and backswing cancellation on both the imported native build and its legacy-shaped reference input, so the same deterministic cast and damage timeline assertions cover those rotation controls as well.

The fixture continues to preserve the Talent picks as import data only. Talent effects remain inactive when the authorized TalentDigest dataset is unavailable; no restricted client-derived payload was added to this public repository. The complete CI pipeline passed in run [#45806246782](https://github.com/tengdawei35-beep/rooc-guild-suite/actions/runs/45806246782), including combat regression tests, Prisma generation/migrations, TypeScript, ESLint and production build.
