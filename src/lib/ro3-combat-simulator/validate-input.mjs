/** Validate the native preview's primitive inputs before calling the unchanged engine. */
export function validateCombatInput(draft) {
  const integer = (raw, label, min, max = Number.MAX_SAFE_INTEGER) => {
    if (String(raw).trim() === "") throw new Error(`${label} is required.`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${label} must be a whole number between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
    }
    return value;
  };

  if (!Array.isArray(draft.stats) || draft.stats.length !== 6) {
    throw new Error("Exactly six base stats are required.");
  }
  const level = integer(draft.level, "Attacker level", 1, 200);
  const statNames = ["STR", "AGI", "VIT", "INT", "DEX", "LUK"];
  const stats = draft.stats.map((value, index) => integer(value, statNames[index], 1, 99));
  const defenderLevel = integer(draft.defenderLevel, "Defender level", 1, 200);
  const pdef = integer(draft.pdef, "P.DEF", 0);
  const mdef = integer(draft.mdef, "M.DEF", 0);
  const element = integer(draft.element, "Element ID", 0);
  const race = integer(draft.race, "Race ID", 0);
  const size = integer(draft.size, "Size ID", 0);
  const durationMs = integer(draft.durationMs, "Duration", 1000, 300000);
  const tokens = String(draft.skillIds).trim() ? String(draft.skillIds).trim().split(/[\s,;]+/) : [];
  const skillIds = tokens.map((token) => {
    if (!/^\d+$/.test(token)) {
      throw new Error("Skill IDs must be positive whole numbers, separated by commas or spaces.");
    }
    const id = Number(token);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("Skill IDs must be positive whole numbers, separated by commas or spaces.");
    }
    return id;
  });
  return { level, stats, defenderLevel, pdef, mdef, element, race, size, durationMs, skillIds };
}
