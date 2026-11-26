/** Type surface for the extracted calculation engine's browser-safe in-memory adapter. */
export type Ro3DataRow = Record<string, unknown>;
export type Ro3GameTables = Record<string, Record<string, Ro3DataRow>>;

export declare class Ro3MemoryDataStore {
  constructor(tables: Ro3GameTables);
  table(name: string): Record<string, Ro3DataRow>;
  row(tableName: string, id: string | number): Ro3DataRow | null;
}

export declare function totalStatPoints(level: number, bonusPoints?: number, data?: Ro3MemoryDataStore): number;
export declare function statCost(value: number, data?: Ro3MemoryDataStore): number;
export declare function usedStatPoints(stats6: number[], data?: Ro3MemoryDataStore): number;
export declare function computeStatSheet(raw: Record<string, number>, data?: Ro3MemoryDataStore): { data: Record<number, number>; base: Record<number, number>; [key: number]: any };

export declare function simulateRotation(
  build: Record<string, any>,
  defender: Record<string, any>,
  rotationSkillIds: number[],
  durationMs?: number,
  data?: Ro3MemoryDataStore,
  trace?: unknown[] | null,
): {
  durationMs: number;
  totalExpectedDamage: number;
  sustainedDps: number;
  burst5sDps: number;
  casts: number;
  autoSwings: number;
  groundTicks: number;
  sampleTimeline: unknown[];
  castLog: unknown[];
};

export declare function buildCharacterStats(build: Record<string, any>, data?: Ro3MemoryDataStore, skipTotemOp10?: boolean): { data: Record<number, number>; base: Record<number, number>; [key: number]: any };

export declare function gearParts(gear: Record<string, any>, data?: Ro3MemoryDataStore): any;

export declare function cardParts(card: Record<string, any>, data?: Ro3MemoryDataStore): any;

export declare function petSlotStats(slot: Record<string, any>, kind: "fight" | "assist", index: number, level: number, data?: Ro3MemoryDataStore): Array<[number, number]>;
export declare function petStats(pets: Array<Record<string, any> | null>, assist: Array<Record<string, any> | null>, level: number, data?: Ro3MemoryDataStore): Array<[number, number]>;
export declare function petEffects(pets: Array<Record<string, any> | null>, data?: Ro3MemoryDataStore): Record<string, any>;
export declare function talentOptions(branch: string | number, career: number, prof: number, data?: Ro3MemoryDataStore): Array<Record<string, any>>;
export declare function talentPick(talents: Record<string, any>, branch: string | number, career: number, data?: Ro3MemoryDataStore): [number, number];
export declare function talentWalk(build: Record<string, any>, data?: Ro3MemoryDataStore): Record<string, any>;
export declare function talentEffects(build: Record<string, any>, data?: Ro3MemoryDataStore): Record<string, any>;
export declare function talentMax(build: Record<string, any>, data?: Ro3MemoryDataStore): number;
