# RO3 simulator-backed rotation evaluator

## Purpose

`evaluateRo3Rotation()` evaluates a supplied skill cycle with the exact embedded simulator's `simulateRotation()` scheduler. It is the next step beyond per-skill output: cooldowns, cast locks, auto-swings, multi-hit/ground effects, and modeled simulator interactions are handled by the simulator rather than approximated by adding per-skill instant-DPS values.

## Inputs

- Persisted RO3 stat snapshot accepted by `persisted-stat-adapter.ts`.
- Explicit simulator `careerId` (the `JobConfig` key, not a Heimdall job label).
- Explicit `skillIds` in intended priority/cycle order.
- Optional duration from 5 to 120 seconds (default 30 seconds).
- Optional passive skill IDs that exist in simulator `SkillConfig`.

The evaluator reconciles supported persisted sheet values against the selected career's Level 99 simulator sheet, then supplies the resulting stat deltas to the simulator. This prevents a persisted PATK/MATK total from simply being stacked on top of a second full career base sheet.

## Outputs

- Sustained DPS over the requested window.
- First-five-second burst DPS.
- Expected total damage, cast count, auto-swings, and ground ticks.
- Invalid/missing skill IDs that were skipped.
- Excluded persisted fields and exact simulator-engine SHA-256.
- `score: null`: no normalized member score is produced.

## Guardrails

- The embedded Heimdall simulator remains the authoritative calculation model for mechanics it implements.
- The function does not infer a rotation from a job label or claim that a supplied sequence is optimal.
- The current data does not establish complete, named-job reference rotations for every RO3 DPS archetype. Do not fabricate job skill lists or map Heimdall job labels to simulator career IDs without evidence.
- Gear, cards, pets, active buffs, totems, and other unpersisted build effects are omitted by this evaluator. Only supported persisted stats and explicitly supplied passive skill IDs are included.
- A rotation DPS estimate is not a normalized 0–100 member score. Population normalization remains deferred until meaningful persisted profile data exists.
- Tank/PvP evaluation remains out of scope; the outgoing-damage rotation engine does not provide a complete incoming-damage model.

## Tests

`npm run test:ro3-scoring` includes deterministic checks for simulator execution, invalid skill filtering, required career/duration validation, and rejection of rotations without a valid damage skill.
