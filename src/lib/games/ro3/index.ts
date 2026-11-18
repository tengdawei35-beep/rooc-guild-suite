import type { GameRuntimeModule } from "@/lib/games/types";
import { ro3ApplicationAdapter } from "./application";

export { RO3_JOBS, isRO3Job } from "./jobs";
export type { RO3Job } from "./jobs";
export { RO3_NUMERIC_STATS, RO3_SPECIAL_DISH_SLOTS, RO3_DEFAULT_SPECIAL_DISH_LABELS } from "./stats";
export type { RO3CharacterStats, RO3SpecialDishLabels } from "./stats";

export const ro3Module: GameRuntimeModule = {
  gameType: "RO3",
  application: ro3ApplicationAdapter,
};
