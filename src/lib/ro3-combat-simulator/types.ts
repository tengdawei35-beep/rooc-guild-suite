export type AttributePair = [attributeId: number, value: number];

export interface CombatBuild {
  career: number;
  level: number;
  stats: [number, number, number, number, number, number];
  element?: number;
  equipmentAttrs?: AttributePair[];
  affixAttrs?: AttributePair[];
  enchantAttrs?: AttributePair[];
  cardAttrs?: AttributePair[];
  emblemAttrs?: AttributePair[];
  talentAttrs?: AttributePair[];
  extraAttrs?: AttributePair[];
  passiveSkills?: number[];
  activeBuffs?: Array<number | { id: number; piles?: number; isTotemOwned?: boolean; sourceId?: number }>;
  skillLevels?: Record<number, number>;
  weaponRefine?: number;
  weaponStrengthen?: number;
  currentHp?: number;
  currentSp?: number;
  cancelBackswing?: boolean;
  [key: string]: unknown;
}

export interface CombatDefender {
  name?: string;
  level: number;
  maxHp?: number;
  hp?: number;
  atk?: number;
  matk?: number;
  def: number;
  mdef: number;
  hit?: number;
  flee?: number;
  resCri?: number;
  element: number;
  race: number;
  size: number;
  [key: string]: unknown;
}

export interface CombatRotation {
  id?: string;
  name: string;
  skills: number[];
}

export interface CombatRotationResult {
  durationMs: number;
  totalExpectedDamage: number;
  sustainedDps: number;
  burst5sDps: number;
  casts: number;
  autoSwings: number;
  groundTicks: number;
  sampleTimeline: unknown[];
  castLog: unknown[];
}

export interface CombatWorkspaceState {
  attacker: CombatBuild;
  defender: CombatDefender;
  rotation: CombatRotation;
  durationMs: number;
}

export interface CombatDistributionSkill {
  id: number;
  name: string;
  kind: string;
  magic: boolean;
  events: number;
  total: number;
  hits: number;
  crits: number;
  misses: number;
  lo: number;
  hi: number;
  perBucket: Float64Array;
  normalBins: Uint32Array;
  critBins: Uint32Array;
}

export interface CombatDistributionResult {
  runs: number;
  durationMs: number;
  bucketMs: number;
  nBuckets: number;
  bins: number;
  expectedTotal: number;
  deterministic: CombatRotationResult;
  totals: Float64Array;
  cumulative: Float64Array;
  skills: CombatDistributionSkill[];
  sampleRun?: Array<Record<string, unknown>>;
}
