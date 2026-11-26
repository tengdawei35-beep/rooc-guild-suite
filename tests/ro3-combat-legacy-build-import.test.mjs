import test from "node:test";
import assert from "node:assert/strict";
import { importLegacyRoyalGuardBuild, parseLegacyBuildBook } from "../src/lib/ro3-combat-simulator/legacy-build-import";
import { buildCharacterStats, Ro3DataStore, simulateRotation } from "../src/lib/ro3-combat-simulator/engine/ro3-damage-engine.mjs";

const defaults = {
  level:"100",stats:["1","1","1","1","1","1"],
  equipment:{
    gear:Array.from({length:7},()=>({id:0,roll:5000,refine:0,enhance:0,affixes:[],stunts:[],offRefine:0,offEnhance:0})),
    cards:Array.from({length:18},()=>({id:0,star:3,level:15,flash:false})),
  },
  pets:[null,null,null,null],assistPets:[null,null,null],enchantAttrs:[],extraAttrInput:"",petCollectionAttrInput:"",attackerElement:"1",bondBonusBp:"0",emblemAttrInput:"",totemLoadoutInput:"",totemLevel:"0",
  totemSkillIds:"",totemAttrInput:"",totemEnhanceBp:"0",resonanceRefine:"0",resonanceEnhance:"0",
  talentLevel:"0",talentProf:"0",talentPicks:{},passiveSkillIds:"",talentSkillLevels:"",
  activeBuffIds:"",skillLevels:"",rotationCycle:false,cancelBackswing:false,periodicOff:false,
  periodicStartSeconds:"0",ridden:false,def:"0",mdef:"0",targetLevel:"100",element:"1",race:"1",size:"2",
  skillIds:"",disabledRotationIds:"",duration:"30000",
};

test("imports current Royal Guard legacy state and maps supported inputs",()=>{
  const state={
    v:15,job:1410,level:150,element:4,bonus:{boss:125},stats:[90,80,70,20,60,10],skills:{11608:5,11611:3},
    rotation:[11608,11611],disabledRotation:[11611],gear:[{id:9001,roll:7500,refine:10,enh:8,aff:[1,2],sp:[3,4]}],
    cards:[{id:7001,star:2,lv:10,flash:true}],pets:[{id:10,lv:99,star:4,stage:1}],
    assist:[{g:12,lv:80,star:3,stage:0}],res:{refine:15,enhance:20},
    talents:{lv:30,prof:4,picks:{"1":[11,12]}},sim:{seconds:45,cycle:1,cancel:1,howl:-1},
    target:{def:1980,mdef:1200,level:200,element:2,race:3,size:1},ex:{103:100,1:12,1031:450},petCollect:[[104,50]],echoUseEntries:true,echoes:[{id:501,stats:[{a:105,v:25}],colors:["red"]}],totemLv:4,totems:[{id:7001,attrs:[[103,30]],skills:[9001]}],
  };
  const result=importLegacyRoyalGuardBuild(state,defaults,[{groupId:11608,id:1160805,level:5},{groupId:11611,id:1161103,level:3}]);
  assert.ok(result.draft);
  assert.equal(result.draft.level,"150");
  assert.equal(result.draft.attackerElement,"4");
  assert.equal(result.draft.bondBonusBp,"12500");
  assert.deepEqual(result.draft.stats,["90","80","70","20","60","10"]);
  assert.equal(result.draft.equipment.gear[0].id,9001);
  assert.deepEqual(result.draft.equipment.gear[0].affixes,[1,2]);
  assert.equal(result.draft.equipment.cards[0].flash,true);
  assert.equal(result.draft.skillIds,"1160805, 1161103");
  assert.equal(result.draft.disabledRotationIds,"1161103");
  assert.equal(result.draft.duration,"45000");
  assert.equal(result.draft.periodicOff,true);
  assert.equal(result.draft.ridden,true);
  assert.equal(result.draft.def,"1980");
  assert.equal(result.draft.extraAttrInput,"1:12, 103:100, 1031:450");
  assert.equal(result.draft.petCollectionAttrInput,"104:50");
  assert.equal(result.draft.emblemAttrInput,"105:25");
  assert.equal(result.draft.totemLevel,"4");
  assert.deepEqual(JSON.parse(result.draft.totemLoadoutInput),[{guid:1,id:7001,attrs:[[103,30]],skills:[9001],enhanceBp:0}]);
  assert.ok(!result.unsupported.some((item)=>item.includes("Echo/emblem")||item.includes("totem")||item.includes("pet collection")||item.includes("typed/aggregated")));
  assert.ok(result.warnings.some((item)=>item.includes("mark and proc effects")));
});

test("rejects non-Royal Guard and unmigrated legacy versions",()=>{
  assert.equal(importLegacyRoyalGuardBuild({v:15,job:1400},defaults,[]).draft,null);
  assert.equal(importLegacyRoyalGuardBuild({v:14,job:1410},defaults,[]).draft,null);
});

test("parses legacy tab books defensively",()=>{
  const book={v:1,active:2,builds:[{id:1,name:"RG",state:{v:15,job:1410}},{id:1,name:"duplicate",state:{}},{id:"2",name:"bad",state:{}}]};
  assert.deepEqual(parseLegacyBuildBook(JSON.stringify(book)),[{id:1,name:"RG",state:{v:15,job:1410}}]);
  assert.deepEqual(parseLegacyBuildBook("bad-json"),[]);
});

test("legacy import golden fixture preserves legacy character-sheet attribute sources",()=>{
  const state={
    v:15,job:1410,level:150,element:4,bonus:{boss:125},stats:[90,80,70,20,60,10],
    ex:{103:100,1:12,1031:450},petCollect:[[104,50]],
    echoUseEntries:true,echoes:[{id:501,stats:[{a:105,v:25}],colors:["red"]}],
    totemLv:4,totems:[{id:7001,attrs:[[103,30]],skills:[9001]}],
  };
  const imported=importLegacyRoyalGuardBuild(state,defaults,[]);
  assert.ok(imported.draft);
  const pairs=(value)=>value.split(",").filter(Boolean).map((entry)=>entry.trim().split(":").map(Number));
  const nativeBuild={
    career:1410,level:Number(imported.draft.level),element:Number(imported.draft.attackerElement),bondBonusBp:Number(imported.draft.bondBonusBp),stats:imported.draft.stats.map(Number),
    equipmentAttrs:pairs(imported.draft.extraAttrInput),
    extraAttrs:pairs(imported.draft.petCollectionAttrInput),
    emblemAttrs:pairs(imported.draft.emblemAttrInput),
    totems:JSON.parse(imported.draft.totemLoadoutInput),
  };
  // Reference shape follows the upstream currentBuild() mapping: ex -> equipmentAttrs,
  // petCollect -> extraAttrs, Echo rolls -> emblemAttrs, and deployed Totems -> totems.
  const legacyReference={
    career:1410,level:150,element:4,bondBonusBp:12500,stats:[90,80,70,20,60,10],
    equipmentAttrs:[[1,12],[103,100],[1031,450]],
    extraAttrs:[[104,50]],emblemAttrs:[[105,25]],
    totems:[{guid:1,id:7001,attrs:[[103,30]],skills:[9001],enhanceBp:0}],
  };
  const data=new Ro3DataStore();
  assert.deepEqual(buildCharacterStats(nativeBuild,data),buildCharacterStats(legacyReference,data));
  const defender={level:100,def:0,mdef:0,element:1,race:1,size:2};
  assert.deepEqual(
    simulateRotation(nativeBuild,defender,[],3000,data),
    simulateRotation(legacyReference,defender,[],3000,data),
  );
});

test("imports legacy any-profession talent mode as profession zero",()=>{
  const result=importLegacyRoyalGuardBuild({
    v:15,job:1410,level:100,stats:[1,1,1,1,1,1],prof:4,
    talents:{lv:1,any:true,picks:{}},
  },defaults,[]);
  assert.ok(result.draft);
  assert.equal(result.draft.talentProf,"0");
});

test("infers missing legacy totem system level from its stored enhancement",()=>{
  const state={
    v:15,job:1410,level:100,stats:[1,1,1,1,1,1],
    totems:[{id:7001,attrs:[[103,30]],skills:[],enhanceBp:7500}],
  };
  const result=importLegacyRoyalGuardBuild(state,defaults,[],(enhanceBp)=>enhanceBp===7500?3:0);
  assert.ok(result.draft);
  assert.equal(result.draft.totemLevel,"3");
});
