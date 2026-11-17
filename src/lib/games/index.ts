export const GAME_TYPES = ["ROOC", "RO3"] as const;

export type GameType = (typeof GAME_TYPES)[number];

export const GAME_MODULES: Record<
  GameType,
  {
    code: GameType;
    name: string;
    shortName: string;
    description: string;
    status: "available" | "in_development";
  }
> = {
  ROOC: {
    code: "ROOC",
    name: "Ragnarok Online Origin Classic",
    shortName: "ROOC",
    description: "Guild management tools for ROO Classic.",
    status: "available",
  },
  RO3: {
    code: "RO3",
    name: "Ragnarok Online 3",
    shortName: "RO3",
    description: "The RO3 module is being developed.",
    status: "in_development",
  },
};

export function isGameType(value: unknown): value is GameType {
  return typeof value === "string" && GAME_TYPES.includes(value as GameType);
}

export function getGameModule(gameType: GameType) {
  return GAME_MODULES[gameType];
}
