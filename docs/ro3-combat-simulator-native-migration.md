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
| Define typed engine inputs/outputs and expand coverage | Initial models/rotation result defined; broader engine typings pending |
| Typed workspace models and calculation adapter | Initial boundary complete |
| React engine lifecycle hook | Initial hook complete; not connected to production route |
| Build native React component architecture | Isolated preview route, native attacker/defender profile panels, build inputs and simulation report added; full feature parity pending |
| Connect React state to extracted engine | Native Royal Guard baseline build and defender inputs now call the extracted rotation engine; equipment/card/talent and guild-profile mapping pending |
| Migrate profile import and reports | Native preview reads the existing guild profile API and displays selected attacker/defender values; applying profiles to simulator builds and report migration pending |
| Regression/equivalence tests against current iframe | Not started |
| Remove iframe and legacy message bridge | Blocked until equivalence passes |

The authenticated iframe route remains the production path throughout this work.


## Native preview checkpoint

An authenticated, subscription-gated preview is available at `/combat-simulator/native-preview` on the migration branch. It loads the extracted engine/data through the React lifecycle hook and reads the same active-guild member profile API as the legacy workspace. Attacker and defender selections are displayed in native panels for profile-contract verification. This is intentionally an isolated preview: `/combat-simulator` continues to use the existing iframe, and the preview does not yet run a damage calculation or claim parity.


### Native baseline simulation checkpoint

The isolated preview now exposes a deliberately small, explicit baseline build: the existing Royal Guard career ID (1410), six base stats, defender level/P.DEF/M.DEF/element/race/size IDs, optional SkillConfig IDs in rotation order, and simulation duration. It calls the extracted `simulateRotation` through the existing React hook and displays expected damage, sustained DPS, burst-5s DPS, cast counts and cast log. Empty skill rotation uses the engine's normal attack fallback. Guild profiles remain reference-only until their stored stat schema can be mapped without guessing. This is a native-engine smoke workflow, not a complete migration or an equivalence claim.

### Career-aware equipment and card catalog foundation

Added `equipment-options.ts` as a data-only adapter over the exported `ItemConfig` and `EquipConfig` tables. It mirrors the legacy simulator's seven equipment grids, career ancestry restrictions, equipment part/tier mapping, card part/quality ordering, and all 18 card sockets with their unlock levels. The adapter exposes catalog metadata only; it does not yet mutate a combat build or claim that equipment/card effects are represented in the native report. Synthetic regression tests cover job filtering, tier lookup, card naming, and socket definitions. The next step is to connect these catalog entries to a typed native build state and validate the resulting attribute sheet against the legacy implementation before expanding report parity.

### Native equipment and card build integration

The isolated React preview now exposes the seven equipment grids and all 18 card sockets using the exported game-data catalogs. Equipment choices are filtered by Royal Guard's career ancestry, slot compatibility and the character's current level. The native selection adapter maps chosen items to the existing engine's `gear` and `cards` inputs; no damage formulas were changed. Basic refine/enhance levels, gear roll position (0–10000), card star/level, and the Collection/flash toggle are editable. Equipment and card socket level restrictions are enforced in both the UI and the native-to-engine adapter. The resulting character sheet displays P.ATK, M.ATK, P.DEF, M.DEF, HIT and CRIT. Selected equipment and cards are passed into both `buildCharacterStats` and the native damage simulation.

Current limitations are explicit: affix selection and random/fixed stunt selection are not yet exposed; two-handed off-hand grid handling is incomplete. The Collection/flash toggle is wired to the engine card input but still needs data-backed equivalence fixtures. No parity claim is made for the full build. Regression tests cover the catalog and native-to-engine mapping. Production remains on the iframe until full build and report equivalence are demonstrated.


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

### Native saved builds (local preview)

The native React preview now supports a versioned, browser-local saved-build collection (up to eight entries). It stores the editable native inputs for the Royal Guard build: base stats, equipment/cards, pets, enchantments, emblems/totems, resonance, talents/passives, defender settings and skill rotation. Loading a saved build restores those inputs and clears the previous simulation report so stale results are not mistaken for the newly loaded setup.

The storage format is versioned at `hmdl.ro3.native-builds.v1`, validates restored values, deduplicates IDs and safely ignores malformed or unsupported entries. Guild profile selections and simulation output are intentionally excluded. These native saved builds are local to the current browser; they are not synced across devices or stored in the guild database.

This is the first native persistence layer, not a complete legacy-tab migration. The legacy iframe uses its own `ro3sim.builds.v1` state with broader class, skill, target and simulation settings. Importing those tabs remains gated on full field-by-field mapping and explicit reporting of any unsupported values; the migration must not silently discard typed attributes, rotations or advanced systems.

### Native report presentation checkpoint

- Replaced the raw JSON cast-log dump with a structured, collapsible event list showing time, event type, name, hit count and lock/duration where supplied by the engine.
- Added a separate sample-damage-events list from the engine's sampled timeline, showing impact time, skill and expected damage.
- The engine's sample timeline is intentionally bounded by its existing sampling behaviour; the full cast log remains available in the native report.
- The preview now explicitly reports when the generated `TalentDigest` is absent. In that case, talent picks do not affect the result; the source-table digest generation is still outstanding.
