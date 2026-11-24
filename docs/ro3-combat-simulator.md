# RO3 Combat Simulator — integration notes

## Source and attribution

The embedded simulator is adapted from the community research project [hksekai/ro3-damage-sim](https://github.com/hksekai/ro3-damage-sim). The project owner has granted permission for Heimdall to redistribute and integrate the simulator. Preserve this attribution in product UI and future source updates.

The upstream single-file UI is retained intact at `src/lib/ro3-combat-simulator/ro3-damage-sim.html`. It contains its own UI, engine, timing data, and game-data tables. It is intentionally kept out of `public/` so it is not exposed as an unprotected static asset; serve it only through an authenticated, entitlement-checked application route.

Upstream describes the model as a community R&D implementation faithful to selected `ro3emu-server` code paths, not an official game implementation. Some effects are inferred or unsupported. Treat outputs as estimates, not authoritative in-game results.

## Verified core damage model

The following is a high-level transcription of `evaluateSkillDamage` in the upstream engine. The implementation has additional skill-specific parameter rules, card/totem effects, buffs, proc effects, rounding, and target conditions.

1. **Skill base**: determine physical vs magic damage from the skill damage type (including hybrid skills), then select the skill branch's ratio `p1` and flat component `p2`. Compute `rawSkillDamage = ((attackStat × p1) / 10,000 + p2) × skillScale`. Physical skills use ATK; magic skills use MATK. The engine also models the special bonus ATK/MATK attributes.
2. **Defence mitigation**: `1 − DEF / (DEF + 20 × attackerLevel)`, using PDEF for physical damage and MDEF for magic damage. The source comments explicitly identify the level choice as an emulator interpretation/inference; the engine currently uses attacker level.
3. **Element**: resolve the skill/attacker element against the defender element using the upstream element table. The multiplier is clamped to 0.1–10.0 and applies the engine's Elemental Counter Ignore handling when the matchup is disadvantageous.
4. **Damage bonuses**: apply the appropriate physical or magic, melee or ranged, skill-element, target-element/race/size, equipment-resonance, buff-layer, bond, and supported totem modifiers. The upstream engine keeps several bonus brackets separate.
5. **Variance and critical**: normal hit range uses 97%–103% of the pre-adjusted base. Physical critical damage uses a 1.5 multiplier before the critical damage adjustment attribute; magic skills cannot crit in this model. The result is rounded and post-hit modifiers are applied.
6. **Hit probability**: `1 − flee/(flee+600) + 0.5 × hit/(hit+600)`, clamped to 30%–100%, unless the skill is marked as guaranteed hit.
7. **Critical probability**: physical only; based on max(0, attacker CRI − defender CRI resistance), the skill's critical factor, and its flat skill critical addition, clamped to 0%–100%.

## Offensive / defensive stat counterpart mapping

| Offensive stat family | Defensive counterpart / interpretation |
| --- | --- |
| Physical damage bonus | Physical damage reduction |
| Magic damage bonus | Magic damage reduction |
| PDMG / MDMG increase | Corresponding PDMG / MDMG reduction |
| Damage vs Medium | Damage reduction vs Medium |
| Damage vs Small / Large | Damage reduction vs corresponding size |
| Damage vs race / element | Corresponding damage reduction / target-side mitigation where the source engine models it |
| CRI | CRI resistance |
| HIT | FLEE |
| Physical penetration / ignore PDEF | PDEF |
| Magic penetration / ignore MDEF | MDEF |

These are conceptual counterpart pairs, not a claim that every pair is a simple subtraction or that all attributes are currently applied by the imported upstream engine. The current source model's exposed damage evaluation uses DEF/MDEF mitigation and selected bonus attributes; do not assume it simulates every PvP-only stat or every game effect.

## Known limitations to disclose in the UI

Upstream README notes that Divine Totem execute effects, healing, shields, and PvP effects are not fully simulated. The engine itself documents inferred brackets and unsupported skill-affect types. The source is a best-effort community model and should show an estimate disclaimer.

## Planned Heimdall product work

- Deliver the simulator behind authenticated application routing; do not publish the raw HTML under `public/`.
- Add a dedicated combat-simulator entitlement that can be granted to a guild as an add-on or to an individual user.
- Keep guild add-on and individual subscription records distinct from the existing base guild subscription to avoid changing Basic/Total entitlements.
- Add attacker/defender presets from saved member stats, while allowing manual edits.
- Use the source engine's own self-tests and regression fixtures when the engine is extracted into a testable module.
- Establish and document versioned PvP, DPS, and Tank scoring weights before ranking members. Scores must normalize inputs and avoid rewarding duplicate/overlapping stats twice.

## Heimdall integration status

The current Heimdall branch includes:
- A protected `/combat-simulator` workspace and an authenticated, non-cacheable source endpoint.
- Personal subscriptions and guild add-on subscriptions, separate from the existing Basic / Total guild-plan records.
- Server-side entitlement checks for both purchase types.
- Billing UI and Stripe Customer Portal routing for personal and guild add-on subscriptions.
- Guild member attacker presets that fit imported HP, PATK, MATK, PDEF and MDEF to the simulator's final stat sheet; defender presets import PDEF and MDEF into the target panel.
- Manual simulator builds remain available when no member preset is selected.

### Stripe configuration

Set eight recurring Stripe Price IDs before enabling checkout. Configure all eight with a monthly interval and interval counts of 1, 3, 6 and 12 months respectively:
- `STRIPE_PRICE_COMBAT_SIMULATOR_PERSONAL_MONTHLY`
- `STRIPE_PRICE_COMBAT_SIMULATOR_PERSONAL_QUARTERLY`
- `STRIPE_PRICE_COMBAT_SIMULATOR_PERSONAL_SEMIANNUAL`
- `STRIPE_PRICE_COMBAT_SIMULATOR_PERSONAL_ANNUAL`
- `STRIPE_PRICE_COMBAT_SIMULATOR_GUILD_MONTHLY`
- `STRIPE_PRICE_COMBAT_SIMULATOR_GUILD_QUARTERLY`
- `STRIPE_PRICE_COMBAT_SIMULATOR_GUILD_SEMIANNUAL`
- `STRIPE_PRICE_COMBAT_SIMULATOR_GUILD_ANNUAL`

The guild add-on requires an active Basic or Total guild subscription. Individual subscriptions do not require a guild add-on or an active guild plan. Both purchase types are synchronized through Stripe subscription webhooks.

### Member preset scope

The first preset bridge imports the final core stat values stored by Heimdall. It does not yet reconstruct the complete equipment, card, pet, talent, skill-tree or buff loadout from OCR JSON. After importing an attacker, confirm the job and skill and review all other build components manually. The defender preset only replaces target PDEF and MDEF.
