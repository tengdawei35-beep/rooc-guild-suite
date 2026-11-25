import { CARD_SOCKETS, EQUIPMENT_GRIDS, type CardOption, type EquipmentOption } from "./equipment-options";

export type NativeGearSlot = { id: number; roll: number; refine: number; enhance: number; affixes: number[]; stunts: number[]; offRefine: number; offEnhance: number };
export type NativeCardSlot = { id: number; star: number; level: number; flash?: boolean };
export type NativeEquipmentSelection = { gear: NativeGearSlot[]; cards: NativeCardSlot[] };

export const emptyNativeEquipmentSelection = (): NativeEquipmentSelection => ({
  gear: EQUIPMENT_GRIDS.map(() => ({ id: 0, roll: 5000, refine: 0, enhance: 0, affixes: slot.affixes.slice(0,2), stunts: slot.stunts.slice(0,2),
      ...(index === 0 ? { offRefine: Math.max(0, Math.min(caps?.refine[1] ?? 99, Math.round(slot.offRefine))), offEnhance: Math.max(0, Math.min(caps?.enhance[1] ?? 999, Math.round(slot.offEnhance))) } : {}), offRefine: 0, offEnhance: 0 })),
  cards: CARD_SOCKETS.map(() => ({ id: 0, star: 3, level: 15, flash: false })),
});

/** Convert UI selections into the exact gear/card shape already consumed by buildCharacterStats. */
export type GearLevelCaps = { refine: number[]; enhance: number[] };

export function toEngineEquipment(selection: NativeEquipmentSelection, equipment: EquipmentOption[], cards: CardOption[], baseLevel = 200, caps?: GearLevelCaps) {
  const gear = selection.gear.flatMap((slot, index) => {
    const item = equipment.find((candidate) => candidate.id === slot.id);
    if (!item || item.levelRequired > baseLevel || !EQUIPMENT_GRIDS[index]?.parts.includes(item.part)) return [];
    return [{
      grid: index + 1, id: item.id, roll: Math.max(0, Math.min(10000, Math.round(slot.roll))),
      affixes: [], stunts: [],
      refine: Math.max(0, Math.min(caps?.refine[index] ?? 99, Math.round(slot.refine))),
      enhance: Math.max(0, Math.min(caps?.enhance[index] ?? 999, Math.round(slot.enhance))),
    }];
  });
  const activeCards = selection.cards.flatMap((slot, index) => {
    const item = cards.find((candidate) => candidate.id === slot.id);
    const socket = CARD_SOCKETS[index];
    if (!item || !socket || baseLevel < socket.levelRequired || item.part !== socket.part) return [];
    return [{
      id: item.id, star: Math.max(0, Math.min(3, Math.round(slot.star))),
      level: Math.max(0, Math.min(15, Math.round(slot.level))), flash: !!slot.flash,
    }];
  });
  return { gear, cards: activeCards };
}
