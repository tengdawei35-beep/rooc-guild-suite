import test from "node:test";
import assert from "node:assert/strict";
import { getCombatEquipmentCatalog, CARD_SOCKETS, EQUIPMENT_GRIDS } from "../src/lib/ro3-combat-simulator/equipment-options.ts";

test("equipment catalog respects career ancestry, item parts and equipment tier", () => {
  const tables = {
    ItemConfig: {
      "1": { _iID:1,_iType:5,_iEquipPart:1,_iEquipId:10,_iQuality:6,_iLevelNeed:90,_kJobNeed:[0],name:"Universal Sword" },
      "2": { _iID:2,_iType:5,_iEquipPart:4,_iEquipId:11,_iQuality:5,_iLevelNeed:70,_kJobNeed:[100],name:"Ancestor Armor" },
      "3": { _iID:3,_iType:5,_iEquipPart:5,_iEquipId:12,_iQuality:5,_iLevelNeed:70,_kJobNeed:[200],name:"Other Class Cloak" },
      "4": { _iID:4,_iType:2,_iCardPart:1,_iQuality:6,name:"Card: Test Card" },
    },
    EquipConfig: { "10":{_iRank:7}, "11":{_iRank:6}, "12":{_iRank:6} },
  };
  const ui = { jobs:[{id:100},{id:1410,parent:100},{id:200}] };
  const result = getCombatEquipmentCatalog(tables,ui,1410);
  assert.deepEqual(result.equipment.map((x)=>x.id),[2,1]);
  assert.equal(result.equipment.find((x)=>x.id===1)?.tier,7);
  assert.equal(result.cards[0].name,"Test Card");
});

test("catalog exposes legacy slot definitions and all 18 card sockets", () => {
  assert.equal(EQUIPMENT_GRIDS.length,7);
  assert.equal(CARD_SOCKETS.length,18);
  assert.equal(CARD_SOCKETS[0].levelRequired,10);
  assert.equal(CARD_SOCKETS[17].name,"Mouth");
});
