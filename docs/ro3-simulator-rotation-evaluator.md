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


## Simulator-authored job profile discovery

`listRo3SimulatorReferenceProfiles()` now inventories candidate rotations already present in the embedded simulator's `CLASS_PROFILES` data for the six Heimdall DPS labels. Five have simulator-authored candidates; Royal Guard is represented explicitly as a missing-profile record:

- Mechanic
- Rune Knight (DPS)
- Warlock
- Ranger
- Guillotine Cross

It reports each candidate's simulator career ID, whether a corresponding `JobConfig` row exists, each rotation's skill IDs, missing skill rows, and damage-skill count. The catalog is review-only (`executable: false`) and deliberately does not import the simulator's sample equipment, refine, stunts, cards, pets, buffs, or totems.

### Gaps surfaced rather than guessed

- Royal Guard (DPS) has a matching simulator-authored `CLASS_PROFILES` entry, but its referenced career ID has no corresponding `JobConfig` row. It is surfaced with `status: career-config-missing`; the evaluator refuses to use a fallback career sheet.
- The current simulator data's `JobConfig` table does not contain the 4th-job career IDs referenced by those profiles. The evaluator now rejects a missing career row instead of silently allowing the engine's Novice fallback sheet to contaminate the result.
- A profile is marked `ready-for-review` only if its career row exists, all listed skill rows exist, and at least one candidate rotation has a valid damage skill. Even then, it is not executable until human review; no profile is currently auto-approved.

This is an intentional data-integrity gate. Add or verify the missing career/skill configuration in the simulator source before using these candidate rotations for member comparisons.
