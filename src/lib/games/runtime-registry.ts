import type { GameType, GameRuntimeModule } from "@/lib/games/types";
import { roocModule } from "@/lib/games/rooc";
import { ro3Module } from "@/lib/games/ro3";

export const GAME_RUNTIME_MODULES: Record<GameType, GameRuntimeModule> = {
  ROOC: roocModule,
  RO3: ro3Module,
};

export function getGameRuntime(gameType: GameType): GameRuntimeModule {
  return GAME_RUNTIME_MODULES[gameType];
}
