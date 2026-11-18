import type { GameRuntimeModule } from "@/lib/games/types";
import { roocApplicationAdapter } from "./application";

export const roocModule: GameRuntimeModule = {
  gameType: "ROOC",
  application: roocApplicationAdapter,
};

export { JOBS } from "./jobs";
export { scoreRooPlayers, findClosestRooMember, calculateRawPdef, calculateRawMdef } from "./scoring";
