import type { GameType } from "@/lib/games";

export type GameApplicationPayload = Record<string, unknown>;

export type GameApplicationValidationResult =
  | { valid: true; normalized: GameApplicationPayload }
  | { valid: false; errors: Record<string, string> };

export interface GameApplicationAdapter {
  validateApplication(payload: GameApplicationPayload): GameApplicationValidationResult;
}

export interface GameRuntimeModule {
  gameType: GameType;
  application: GameApplicationAdapter;
}
