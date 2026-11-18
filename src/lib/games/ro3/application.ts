import type { GameApplicationAdapter, GameApplicationPayload, GameApplicationValidationResult } from "@/lib/games/types";

/** RO3 form validation will be implemented alongside the RO3 character schema. */
export const ro3ApplicationAdapter: GameApplicationAdapter = {
  validateApplication(_payload: GameApplicationPayload): GameApplicationValidationResult {
    return {
      valid: false,
      errors: { form: "RO3 application validation is not yet implemented." },
    };
  },
};
