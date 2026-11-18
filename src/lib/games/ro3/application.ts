import type { GameApplicationAdapter, GameApplicationPayload, GameApplicationValidationResult } from "@/lib/games/types";
import { isRO3Job } from "./jobs";
import { RO3_NUMERIC_STATS, RO3_SPECIAL_DISH_SLOTS } from "./stats";

const statKeys = RO3_NUMERIC_STATS.map((s) => s.key);
const dishKeys = RO3_SPECIAL_DISH_SLOTS.map((s) => s.key);

/** Validates the shared RO3 character payload; role/equipment fields can be added as requirements are defined. */
export const ro3ApplicationAdapter: GameApplicationAdapter = {
  validateApplication(payload: GameApplicationPayload): GameApplicationValidationResult {
    const errors: Record<string, string> = {};
    const characterName = payload.characterName;
    const job = payload.job;
    const stats = payload.stats;

    if (typeof characterName !== "string" || !characterName.trim()) errors.characterName = "Character name is required.";
    if (!isRO3Job(job)) errors.job = "Select a valid RO3 job.";
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
      errors.stats = "Character stats are required.";
    } else {
      const statRecord = stats as Record<string, unknown>;
      for (const key of statKeys) {
        if (typeof statRecord[key] !== "number" || !Number.isFinite(statRecord[key])) errors[key] = "Enter a valid numeric value.";
      }
      for (const slot of RO3_SPECIAL_DISH_SLOTS) {
        const value = statRecord[slot.key];
        if (typeof value !== "number" || !Number.isInteger(value) || value < slot.min || value > slot.max) {
          errors[slot.key] = `Value must be an integer between ${slot.min} and ${slot.max}.`;
        }
      }
    }

    if (Object.keys(errors).length) return { valid: false, errors };

    return {
      valid: true,
      normalized: {
        schemaVersion: 1,
        characterName: (characterName as string).trim(),
        job,
        stats: Object.fromEntries([...statKeys, ...dishKeys].map((key) => [key, (stats as Record<string, number>)[key]])),
        remarks: typeof payload.remarks === "string" ? payload.remarks.trim() || null : null,
      },
    };
  },
};
