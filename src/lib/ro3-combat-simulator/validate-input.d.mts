export type CombatInputDraft = {
  level: string; stats: string[]; defenderLevel: string; pdef: string; mdef: string;
  element: string; race: string; size: string; durationMs: string; skillIds: string;
};
export type ValidatedCombatInput = {
  level: number; stats: [number, number, number, number, number, number];
  defenderLevel: number; pdef: number; mdef: number; element: number; race: number;
  size: number; durationMs: number; skillIds: number[];
};
export declare function validateCombatInput(draft: CombatInputDraft): ValidatedCombatInput;
