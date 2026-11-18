import type { GameApplicationAdapter, GameApplicationPayload, GameApplicationValidationResult } from "@/lib/games/types";

/**
 * Transitional ROOC application adapter.
 * Detailed field validation remains with the existing ROOC application flow until
 * that flow is ported in a dedicated batch.
 */
export const roocApplicationAdapter: GameApplicationAdapter = {
  validateApplication(payload: GameApplicationPayload): GameApplicationValidationResult {
    return { valid: true, normalized: payload };
  },
};
