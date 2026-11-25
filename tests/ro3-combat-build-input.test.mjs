import test from "node:test";
import assert from "node:assert/strict";
import { emptyNativeEquipmentSelection, toEngineEquipment } from "../src/lib/ro3-combat-simulator/build-input.ts";
import { CARD_SOCKETS, EQUIPMENT_GRIDS } from "../src/lib/ro3-combat-simulator/equipment-options.ts";

test("empty native equipment state mirrors all legacy slots", () => {
  const state = emptyNativeEquipmentSelection();
  assert.equal(state.gear.length, 7);
  assert.equal(state.cards.length, 18);
  assert.equal(state.cards.every((card) => card.id === 0), true);
});

test("selected gear and cards map to engine-native structures and reject wrong slots", () => {
  const state = emptyNativeEquipmentSelection();
  state.gear[0] = { id: 10, roll: 12000, refine: 3, enhance: 4 };
  state.gear[1] = { id: 11, roll: 5000, refine: 0, enhance: 0 };
  state.cards[0] = { id: 20, star: 3, level: 15 };
  state.cards[1] = { id: 21, star: 2, level: 9 };
  const mapped = toEngineEquipment(
    state,
    [{ id:10,name:"Sword",part:1,quality:6,levelRequired:90,tier:7,rank:7 },{ id:11,name:"Wrong slot",part:4,quality:5,levelRequired:70,tier:6,rank:6 }],
    [{ id:20,name:"Weapon card",part:1,quality:6 },{ id:21,name:"Weapon card 2",part:1,quality:5 }],
  );
  assert.deepEqual(mapped.gear.map((g)=>g.grid),[1]);
  assert.equal(mapped.gear[0].roll,10000);
  assert.deepEqual(mapped.cards.map((c)=>c.id),[20,21]);
  const lowLevel = toEngineEquipment(state, [{ id:10,name:"Sword",part:1,quality:6,levelRequired:90,tier:7,rank:7 }], [{ id:20,name:"Weapon card",part:1,quality:6},{ id:21,name:"Offhand card",part:2,quality:5 }], 10);
  assert.equal(lowLevel.gear.length,0);
  assert.deepEqual(lowLevel.cards.map((card)=>card.id),[20]);
  assert.equal(EQUIPMENT_GRIDS.length,7);
  assert.equal(CARD_SOCKETS.length,18);
});
