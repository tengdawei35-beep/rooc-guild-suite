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
| Build native React component architecture | Not started |
| Connect React state to extracted engine | Not started |
| Migrate profile import and reports | Not started |
| Regression/equivalence tests against current iframe | Not started |
| Remove iframe and legacy message bridge | Blocked until equivalence passes |

The authenticated iframe route remains the production path throughout this work.
