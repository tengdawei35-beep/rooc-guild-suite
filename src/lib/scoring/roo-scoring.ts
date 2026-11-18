export type RooScoringStats = {
  job?: string | null;
  pdef?: number | null;
  mdef?: number | null;
  pvpDamageBonus?: number | null;
  pvpDamageReduction?: number | null;
  pdmgPercent?: number | null;
  mdmgPercent?: number | null;
  pdmgReductionPercent?: number | null;
  mdmgReductionPercent?: number | null;
  critRes?: number | null;
  ignorePdef?: number | null;
  ignoreMdef?: number | null;
  damageVsMedium?: number | null;
  damageReductionVsMedium?: number | null;
  damageVsSmall?: number | null;
  damageReductionVsSmall?: number | null;
  damageVsDemiHuman?: number | null;
  damageReductionVsDemiHuman?: number | null;
  damageVsBrute?: number | null;
  damageReductionVsBrute?: number | null;
  equipmentPdefPercent?: number | null;
  equipmentMdefPercent?: number | null;
  patk?: number | null;
  matk?: number | null;
  hp?: number | null;
};

export type RooScoredPlayer<T extends RooScoringStats = RooScoringStats> = T & {
  rawPdef: number;
  rawMdef: number;
  tankScore: number;
  dpsScore: number;
  pvpScore: number;
  tankPercentile: number;
  dpsPercentile: number;
  pvpPercentile: number;
};

const SUPPORT_CLASSES = new Set([
  "High Priest",
  "Priest",
  "Bard",
  "Gypsy",
  "Biochemist",
  "Biochemist (Plant)",
  "Doram (Support)",
  "Lord Knight",
]);

const MAGIC_CLASSES = new Set([
  "High Wizard",
  "Professor",
  "Doram (Magic)",
]);

function number(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function calculateRawPdef(
  equipmentPdef: number | null | undefined,
  equipmentPdefPercent: number | null | undefined,
) {
  const absolute = number(equipmentPdef);
  const percent = number(equipmentPdefPercent) / 100;
  return percent <= -1 ? 0 : absolute / (1 + percent);
}

export function calculateRawMdef(
  equipmentMdef: number | null | undefined,
  equipmentMdefPercent: number | null | undefined,
) {
  const absolute = number(equipmentMdef);
  const percent = number(equipmentMdefPercent) / 100;
  return percent <= -1 ? 0 : absolute / (1 + percent);
}

function percentile(value: number, values: number[]) {
  const unique = [...new Set(values)].sort((a, b) => a - b);

  if (unique.length <= 1) {
    return 100;
  }

  let lower = 0;
  for (const candidate of unique) {
    if (candidate < value) lower += 1;
  }

  return (lower / (unique.length - 1)) * 100;
}

function isMagicDps(job: string) {
  return MAGIC_CLASSES.has(job);
}

function isSupport(job: string) {
  return SUPPORT_CLASSES.has(job);
}

function percentileFor<T extends RooScoringStats>(
  player: T,
  players: T[],
  getter: (player: T) => number,
) {
  return percentile(getter(player), players.map(getter));
}

export function scoreRooPlayers<T extends RooScoringStats>(players: T[]): RooScoredPlayer<T>[] {
  const prepared = players.map((player) => ({
    player,
    rawPdef: calculateRawPdef(player.pdef, player.equipmentPdefPercent),
    rawMdef: calculateRawMdef(player.mdef, player.equipmentMdefPercent),
  }));

  const stat = (player: T, key: keyof RooScoringStats) => number(player[key] as number | null | undefined);
  const rawPdef = (player: T) => calculateRawPdef(player.pdef, player.equipmentPdefPercent);
  const rawMdef = (player: T) => calculateRawMdef(player.mdef, player.equipmentMdefPercent);
  const job = (player: T) => String(player.job ?? "").trim();

  const tankScores = prepared.map(({ player }) => {
    const score =
      percentileFor(player, players, (p) => rawPdef(p)) * 20 +
      percentileFor(player, players, (p) => rawMdef(p)) * 20 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsDemiHuman")) * 15 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsMedium")) * 15 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsSmall")) * 15 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsBrute")) * 15 +
      percentileFor(player, players, (p) => stat(p, "pdmgReductionPercent")) * 10 +
      percentileFor(player, players, (p) => stat(p, "mdmgReductionPercent")) * 10 +
      percentileFor(player, players, (p) => stat(p, "critRes")) * 5 +
      percentileFor(player, players, (p) => stat(p, "pvpDamageReduction")) * 5 +
      percentileFor(player, players, (p) => stat(p, "hp")) * 5;

    return score / 135;
  });

  const dpsScores = prepared.map(({ player }) => {
    const mainJob = job(player);
    const magicDps = isMagicDps(mainJob);
    const paladin = mainJob === "Paladin";
    const offensiveStatScore = magicDps || mainJob === "High Priest" || mainJob === "Priest"
      ? percentileFor(player, players, (p) => stat(p, "matk"))
      : percentileFor(player, players, (p) => stat(p, "patk"));

    const ignoreScore = magicDps
      ? percentileFor(player, players, (p) => stat(p, "ignoreMdef"))
      : percentileFor(player, players, (p) => stat(p, "ignorePdef"));

    const damageScore = magicDps
      ? percentileFor(player, players, (p) => stat(p, "mdmgPercent"))
      : percentileFor(player, players, (p) => stat(p, "pdmgPercent"));

    if (paladin) {
      const score =
        ignoreScore * 35 +
        damageScore * 25 +
        offensiveStatScore * 5 +
        percentileFor(player, players, (p) => stat(p, "pvpDamageBonus")) * 5 +
        percentileFor(player, players, (p) => rawPdef(p)) * 10 +
        percentileFor(player, players, (p) => rawMdef(p)) * 10 +
        percentileFor(player, players, (p) => stat(p, "damageReductionVsDemiHuman")) * 5 +
        percentileFor(player, players, (p) => stat(p, "damageReductionVsMedium")) * 5 +
        percentileFor(player, players, (p) => stat(p, "damageReductionVsSmall")) * 5 +
        percentileFor(player, players, (p) => stat(p, "damageReductionVsBrute")) * 5 +
        percentileFor(player, players, (p) => stat(p, "pdmgReductionPercent")) * 3 +
        percentileFor(player, players, (p) => stat(p, "mdmgReductionPercent")) * 3 +
        percentileFor(player, players, (p) => stat(p, "critRes")) * 2 +
        percentileFor(player, players, (p) => stat(p, "pvpDamageReduction")) * 2;

      return score / 130;
    }

    const score =
      ignoreScore * 20 +
      percentileFor(player, players, (p) => stat(p, "damageVsDemiHuman")) * 15 +
      percentileFor(player, players, (p) => stat(p, "damageVsMedium")) * 15 +
      percentileFor(player, players, (p) => stat(p, "damageVsSmall")) * 15 +
      percentileFor(player, players, (p) => stat(p, "damageVsBrute")) * 15 +
      damageScore * 10 +
      offensiveStatScore * 5 +
      percentileFor(player, players, (p) => stat(p, "pvpDamageBonus")) * 5 +
      percentileFor(player, players, (p) => rawPdef(p)) * 15 +
      percentileFor(player, players, (p) => rawMdef(p)) * 15 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsDemiHuman")) * 10 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsMedium")) * 10 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsSmall")) * 10 +
      percentileFor(player, players, (p) => stat(p, "damageReductionVsBrute")) * 10 +
      percentileFor(player, players, (p) => stat(p, "pdmgReductionPercent")) * 5 +
      percentileFor(player, players, (p) => stat(p, "mdmgReductionPercent")) * 5 +
      percentileFor(player, players, (p) => stat(p, "critRes")) * 3 +
      percentileFor(player, players, (p) => stat(p, "pvpDamageReduction")) * 2;

    return score / 185;
  });

  const scored = players.map((player, index) => {
    const tankScore = tankScores[index];
    const dpsScore = dpsScores[index];
    const pvpScore = isSupport(job(player))
      ? tankScore
      : dpsScore * 0.6 + tankScore * 0.4;

    return {
      ...player,
      rawPdef: rawPdef(player),
      rawMdef: rawMdef(player),
      tankScore,
      dpsScore,
      pvpScore,
      tankPercentile: percentile(tankScore, tankScores),
      dpsPercentile: percentile(dpsScore, dpsScores),
      pvpPercentile: percentile(pvpScore, scoredPlaceholder(pvpScore, players, tankScores, dpsScores)),
    };
  });

  return scored.map((player) => ({
    ...player,
    pvpPercentile: percentile(player.pvpScore, scored.map((candidate) => candidate.pvpScore)),
  }));
}

function scoredPlaceholder(
  _value: number,
  players: RooScoringStats[],
  tankScores: number[],
  dpsScores: number[],
) {
  return players.map((player, index) => isSupport(String(player.job ?? "").trim()) ? tankScores[index] : dpsScores[index] * 0.6 + tankScores[index] * 0.4);
}

export function findClosestRooMember<T extends RooScoringStats>(
  applicant: RooScoredPlayer<T>,
  members: RooScoredPlayer<T>[],
) {
  if (members.length === 0) return null;

  return members.reduce((closest, member) => {
    const distance = Math.sqrt(
      (member.pvpScore - applicant.pvpScore) ** 2 +
      (member.dpsScore - applicant.dpsScore) ** 2 +
      (member.tankScore - applicant.tankScore) ** 2,
    );

    if (!closest || distance < closest.distance) {
      return { member, distance };
    }

    return closest;
  }, null as { member: RooScoredPlayer<T>; distance: number } | null);
}
