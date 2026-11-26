export type EquipmentGrid = { index: number; name: string; parts: number[] };
export type EquipmentOption = { id: number; name: string; part: number; quality: number; levelRequired: number; tier: number; rank: number };
export type CardSocket = { index: number; part: number; name: string; levelRequired: number };
export type CardOption = { id: number; name: string; part: number; quality: number; unique: boolean };

export const EQUIPMENT_GRIDS: EquipmentGrid[] = [
  { index: 0, name: "Weapon", parts: [1, 2] },
  { index: 1, name: "Off-hand", parts: [3] },
  { index: 2, name: "Armor", parts: [4] },
  { index: 3, name: "Cloak", parts: [5] },
  { index: 4, name: "Shoes", parts: [6] },
  { index: 5, name: "Accessory 1", parts: [7] },
  { index: 6, name: "Accessory 2", parts: [7] },
];

const SOCKET_DEFINITIONS: Array<[number, number]> = [
  [1,10],[1,20],[1,30],[1,40],[2,10],[3,10],[3,20],[4,10],[4,20],
  [5,10],[5,20],[6,10],[6,20],[6,10],[6,20],[7,20],[8,20],[9,20],
];
const CARD_PART_NAMES: Record<number,string> = {
  1:"Weapon",2:"Off-hand / Shield",3:"Armor",4:"Cloak",5:"Shoes",
  6:"Accessory",7:"Head",8:"Headwear",9:"Mouth",
};
export const CARD_SOCKETS: CardSocket[] = SOCKET_DEFINITIONS.map(([part, levelRequired], index, all) => ({
  index, part, levelRequired,
  name: all.filter(([p]) => p === part).length > 1
    ? `${CARD_PART_NAMES[part]} ${all.slice(0,index+1).filter(([p])=>p===part).length}`
    : CARD_PART_NAMES[part],
}));

type Job = { id: number; parent?: number };
type Item = Record<string, unknown> & { _iID?: number; _iType?: number; _iEquipPart?: number; _iEquipId?: number; _iQuality?: number; _iLevelNeed?: number; _kJobNeed?: number[]; _iCardPart?: number; name?: string };
type Tables = { ItemConfig: Record<string, Item>; EquipConfig: Record<string, { _iRank?: number }> };
type Ui = { jobs: Job[] };

function jobAncestry(ui: Ui, career: number): Set<number> {
  const jobs = new Map(ui.jobs.map((job) => [Number(job.id), job]));
  const allowed = new Set<number>();
  let current = jobs.get(career);
  while (current && !allowed.has(Number(current.id))) {
    allowed.add(Number(current.id));
    current = current.parent == null ? undefined : jobs.get(Number(current.parent));
  }
  return allowed;
}

/** Catalogs mirror the legacy simulator's equipment slot, tier, quality and job restrictions. */
export function getCombatEquipmentCatalog(tables: Tables, ui: Ui, career: number) {
  const allowedJobs = jobAncestry(ui, career);
  const items = Object.values(tables.ItemConfig);
  const equipment: EquipmentOption[] = items.flatMap((item) => {
    if (item._iType !== 5 || !Number.isInteger(item._iID) || !Number.isInteger(item._iEquipPart)) return [];
    const equip = tables.EquipConfig[String(item._iEquipId)];
    if (!equip || !Number.isInteger(equip._iRank)) return [];
    const requiredJobs = Array.isArray(item._kJobNeed) ? item._kJobNeed.map(Number) : [];
    if (requiredJobs.length && requiredJobs[0] !== 0 && !requiredJobs.some((id) => allowedJobs.has(id))) return [];
    return [{
      id: Number(item._iID), name: String(item.name ?? `Item ${item._iID}`),
      part: Number(item._iEquipPart), quality: Number(item._iQuality ?? 0),
      levelRequired: Number(item._iLevelNeed ?? 0), tier: Number(equip._iRank), rank: Number(equip._iRank),
    }];
  }).filter((item) => EQUIPMENT_GRIDS.some((grid) => grid.parts.includes(item.part)))
    .sort((a,b)=>a.name.localeCompare(b.name) || a.id-b.id);
  const cards: CardOption[] = items.flatMap((item) => item._iCardPart && Number.isInteger(item._iID) ? [{
    id: Number(item._iID), name: String(item.name ?? `Card ${item._iID}`).replace(/^Card: /,""),
    part: Number(item._iCardPart), quality: Number(item._iQuality ?? 0), unique: !!item._iIfSameCard,
  }] : []).sort((a,b)=>b.quality-a.quality || a.name.localeCompare(b.name));
  return {
    grids: EQUIPMENT_GRIDS,
    equipment,
    cards,
    cardSockets: CARD_SOCKETS,
  };
}
