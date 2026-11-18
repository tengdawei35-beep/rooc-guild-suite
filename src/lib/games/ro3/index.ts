import type { GameRuntimeModule } from "@/lib/games/types";
import { ro3ApplicationAdapter } from "./application";

export const ro3Module: GameRuntimeModule = {
  gameType: "RO3",
  application: ro3ApplicationAdapter,
};
