import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

type Stats = Record<number, number>;
type DamageResult = {
  expectedPerAttempt: number;
  expectedPerCast: number;
  instantDps: number;
  baseDamage: number;
  defMitigation: number;
  magic: boolean;
};
type SimulatorModule = {
  Ro3DataStore: new () => unknown;
  evaluateSkillDamage: (
    build: Record<string, unknown>,
    defender: Record<string, unknown>,
    skillRow: Record<string, unknown>,
    options: { stats: Stats; rulesApplied?: boolean },
    data: unknown,
  ) => DamageResult;
};

const htmlUrl = new URL("./ro3-damage-sim.html", import.meta.url);
const html = await readFile(htmlUrl, "utf8");
const begin = html.indexOf("/* @@ENGINE-BEGIN */");
const end = html.indexOf("/* @@ENGINE-END */");
if (begin < 0 || end <= begin) {
  throw new Error("Could not locate the generated simulator engine markers.");
}
const engineSource = html.slice(begin, end);
export const simulatorEngineSha256 = createHash("sha256").update(engineSource).digest("hex");
const encodedEngine = Buffer.from(engineSource, "utf8").toString("base64");
const simulator = await import(`data:text/javascript;base64,${encodedEngine}`) as SimulatorModule;
const data = new simulator.Ro3DataStore();

export const REFERENCE_LEVEL = 99;
export const REFERENCE_DEFENDER = Object.freeze({
  level: REFERENCE_LEVEL,
  def: 1980,
  mdef: 1980,
  element: 1,
  race: 2,
  size: 2,
  flee: 0,
  resCri: 0,
});

export const REFERENCE_PROFILES = Object.freeze({
  physical: Object.freeze({
    101: 50000, 103: 10000, 104: 6000, 109: 10000, 111: 0,
    209: 0, 211: 0, 213: 0, 215: 0, 227: 0, 229: 0,
    235: 0, 402: 0, 503: 0, 1211: 0, 1215: 0,
  }),
  magic: Object.freeze({
    101: 50000, 103: 6000, 104: 10000, 109: 10000, 111: 0,
    209: 0, 211: 0, 213: 0, 215: 0, 227: 0, 229: 0,
    235: 0, 402: 0, 503: 0, 1213: 0, 1215: 0,
  }),
});

const SKILLS = Object.freeze({
  physical: Object.freeze({
    _iID: 990001, _iSkillID: 990001, _iDmgType: 1, _iEleType: 1,
    _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 0,
    _iActionTime: 1000, _iChantFix: 0, _iChantVar: 0, _iCD: 0,
    _kDamageParam1: [10000], _kDamageParam2: [0], name: "Fixed Physical Probe",
  }),
  magic: Object.freeze({
    _iID: 990002, _iSkillID: 990002, _iDmgType: 2, _iEleType: 1,
    _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 0,
    _iActionTime: 1000, _iChantFix: 0, _iChantVar: 0, _iCD: 0,
    _kDamageParam1: [10000], _kDamageParam2: [0], name: "Fixed Magic Probe",
  }),
});

function copyStats(stats: Readonly<Stats>): Stats {
  return { ...stats };
}

function evaluate(channel: "physical" | "magic", stats: Stats, defender = REFERENCE_DEFENDER): DamageResult {
  const build = { level: REFERENCE_LEVEL, element: 1, activeBuffs: [], cards: [], totems: [] };
  return simulator.evaluateSkillDamage(
    build,
    { ...defender },
    { ...SKILLS[channel] },
    { stats, rulesApplied: true },
    data,
  );
}

function deltaPercent(base: number, next: number): number {
  return base === 0 ? 0 : ((next - base) / base) * 100;
}

export type SensitivityRow = {
  channel: "physical" | "magic";
  input: string;
  baselineDamage: number;
  changedDamage: number;
  absoluteChange: number;
  percentChange: number;
  probe: string;
};

export function buildSensitivityReport() {
  const rows: SensitivityRow[] = [];
  const specs = [
    { channel: "physical" as const, input: "PATK (103)", stat: 103, delta: 1000, probe: "+10% attack" },
    { channel: "physical" as const, input: "P.DMG (211)", stat: 211, delta: 1000, probe: "+1,000 bp / +10 percentage points" },
    { channel: "physical" as const, input: "General DMG (215)", stat: 215, delta: 1000, probe: "+1,000 bp / +10 percentage points" },
    { channel: "physical" as const, input: "Demi-Human target bonus (402)", stat: 402, delta: 1000, probe: "+1,000 bp against fixed Demi-Human target" },
    { channel: "physical" as const, input: "Medium target bonus (503)", stat: 503, delta: 1000, probe: "+1,000 bp against fixed Medium target" },
    { channel: "magic" as const, input: "MATK (104)", stat: 104, delta: 1000, probe: "+10% attack" },
    { channel: "magic" as const, input: "M.DMG (213)", stat: 213, delta: 1000, probe: "+1,000 bp / +10 percentage points" },
    { channel: "magic" as const, input: "General DMG (215)", stat: 215, delta: 1000, probe: "+1,000 bp / +10 percentage points" },
    { channel: "magic" as const, input: "Demi-Human target bonus (402)", stat: 402, delta: 1000, probe: "+1,000 bp against fixed Demi-Human target" },
    { channel: "magic" as const, input: "Medium target bonus (503)", stat: 503, delta: 1000, probe: "+1,000 bp against fixed Medium target" },
  ];

  for (const spec of specs) {
    const baselineStats = copyStats(REFERENCE_PROFILES[spec.channel]);
    const changedStats = copyStats(baselineStats);
    changedStats[spec.stat] = (changedStats[spec.stat] ?? 0) + spec.delta;
    const baseline = evaluate(spec.channel, baselineStats);
    const changed = evaluate(spec.channel, changedStats);
    rows.push({
      channel: spec.channel,
      input: spec.input,
      baselineDamage: baseline.expectedPerCast,
      changedDamage: changed.expectedPerCast,
      absoluteChange: changed.expectedPerCast - baseline.expectedPerCast,
      percentChange: Number(deltaPercent(baseline.expectedPerCast, changed.expectedPerCast).toFixed(4)),
      probe: spec.probe,
    });
  }

  const defenderRows = (["physical", "magic"] as const).map((channel) => {
    const baseline = evaluate(channel, copyStats(REFERENCE_PROFILES[channel]));
    const reducedDefender = {
      ...REFERENCE_DEFENDER,
      ...(channel === "physical" ? { def: 1782 } : { mdef: 1782 }),
    };
    const changed = evaluate(channel, copyStats(REFERENCE_PROFILES[channel]), reducedDefender);
    return {
      channel,
      input: channel === "physical" ? "Target PDEF (105)" : "Target MDEF (106)",
      baselineDamage: baseline.expectedPerCast,
      changedDamage: changed.expectedPerCast,
      absoluteChange: changed.expectedPerCast - baseline.expectedPerCast,
      percentChange: Number(deltaPercent(baseline.expectedPerCast, changed.expectedPerCast).toFixed(4)),
      probe: "-10% target defence; defender remains Level 99",
    };
  });

  const overlaps = (["physical", "magic"] as const).map((channel) => {
    const base = copyStats(REFERENCE_PROFILES[channel]);
    const primaryStat = channel === "physical" ? 211 : 213;
    const baseline = evaluate(channel, base).expectedPerCast;
    const primary = copyStats(base);
    primary[primaryStat] = 1000;
    const general = copyStats(base);
    general[215] = 1000;
    const combined = copyStats(base);
    combined[primaryStat] = 1000;
    combined[215] = 1000;
    const primaryDamage = evaluate(channel, primary).expectedPerCast;
    const generalDamage = evaluate(channel, general).expectedPerCast;
    const combinedDamage = evaluate(channel, combined).expectedPerCast;
    return {
      channel,
      bracket: channel === "physical" ? "P.DMG (211) + General DMG (215)" : "M.DMG (213) + General DMG (215)",
      baselineDamage: baseline,
      primaryOnlyDamage: primaryDamage,
      generalOnlyDamage: generalDamage,
      combinedDamage,
      combinedPercentChange: Number(deltaPercent(baseline, combinedDamage).toFixed(4)),
      additiveBracketExpectedPercent: 20,
      note: "Both values enter the same additive sheet-bonus bracket in the current evaluator; combined uplift should be approximately 20%, not 21%. Integer rounding can cause a tiny deviation.",
    };
  });

  return {
    reportVersion: "RO3_SIM_SENSITIVITY_V1",
    status: "ENGINEERING_PROBE_ONLY",
    simulatorEngineSha256,
    referenceLevel: REFERENCE_LEVEL,
    attackerAndDefenderLevel: REFERENCE_LEVEL,
    defender: REFERENCE_DEFENDER,
    profiles: {
      physical: REFERENCE_PROFILES.physical,
      magic: REFERENCE_PROFILES.magic,
    },
    assumptions: [
      "Fixed synthetic reference profiles and fixed synthetic skill rows; no production member data or cohort percentiles are used.",
      "The skill rows are controlled probes, not claims about the damage of a named in-game skill.",
      "Only one stat changes per sensitivity row; all other inputs remain fixed.",
      "PATK/MATK and percentage modifiers are tested in the simulator's native units.",
      "Penetration, incoming damage reduction, Tank scoring and PvP scoring are outside this harness.",
      "Simulator formula caveats remain applicable; this report is not an in-game validation or a published scoring baseline.",
    ],
    sensitivity: rows,
    targetDefenceSensitivity: defenderRows,
    overlappingBonusTests: overlaps,
  };
}
