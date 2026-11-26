import test from "node:test";
import assert from "node:assert/strict";
import { importLegacyRoyalGuardBuild, parseLegacyBuildBook } from "../src/lib/ro3-combat-simulator/legacy-build-import";
import { buildCharacterStats, simulateDistribution } from "../src/lib/ro3-combat-simulator/engine/ro3-damage-engine.mjs";
import { createRo3CombatDataStore } from "../src/lib/ro3-combat-simulator/create-data-store.ts";

const defaults = {
  level:"100",bonusStatPoints:"0",stats:["1","1","1","1","1","1"],
  equipment:{
    gear:Array.from({length:7},()=>({id:0,roll:5000,refine:0,enhance:0,affixes:[],stunts:[],offRefine:0,offEnhance:0})),
    cards:Array.from({length:18},()=>({id:0,star:3,level:15,flash:false})),
  },
  pets:[null,null,null,null],assistPets:[null,null,null],enchantAttrs:[],extraAttrInput:"",petCollectionAttrInput:"",attackerElement:"1",bondBonusBp:"0",simulationRuns:"3000",simulationSeed:"20260101",emblemAttrInput:"",totemLoadoutInput:"",totemLevel:"0",
  totemSkillIds:"",totemAttrInput:"",totemEnhanceBp:"0",resonanceRefine:"0",resonanceEnhance:"0",
  talentLevel:"0",talentProf:"0",talentPicks:{},passiveSkillIds:"",talentSkillLevels:"",
  activeBuffIds:"",skillLevels:"",rotationCycle:false,cancelBackswing:false,periodicOff:false,
  periodicStartSeconds:"0",ridden:false,def:"0",mdef:"0",targetLevel:"100",element:"1",race:"1",size:"2",
  skillIds:"",disabledRotationIds:"",duration:"30000",
};

test("imports current Royal Guard legacy state and maps supported inputs",()=>{
  const state={
    v:15,job:1410,level:150,bonusPoints:12,element:4,bonus:{boss:125},stats:[90,80,70,20,60,10],skills:{11608:5,11611:3},
    rotation:[11608,11611],disabledRotation:[11611],gear:[{id:9001,roll:7500,refine:10,enh:8,aff:[1,2],sp:[3,4]}],
    cards:[{id:7001,star:2,lv:10,flash:true}],pets:[{id:10,lv:99,star:4,stage:1}],
    assist:[{g:12,lv:80,star:3,stage:0}],res:{refine:15,enhance:20},
    talents:{lv:30,prof:4,picks:{"1":[11,12]}},sim:{seconds:45,runs:5000,seed:123456,cycle:1,cancel:1,howl:-1},
    target:{def:1980,mdef:1200,level:200,element:2,race:3,size:1},ex:{103:100,1:12,1031:450},petCollect:[[104,50]],echoUseEntries:true,echoes:[{id:501,stats:[{a:105,v:25}],colors:["red"]}],totemLv:4,totems:[{id:7001,attrs:[[103,30]],skills:[9001]}],
  };
  const result=importLegacyRoyalGuardBuild(state,defaults,[{groupId:11608,id:1160805,level:5},{groupId:11611,id:1161103,level:3}]);
  assert.ok(result.draft);
  assert.equal(result.draft.level,"150");
  assert.equal(result.draft.bonusStatPoints,"12");
  assert.equal(result.draft.attackerElement,"4");
  assert.equal(result.draft.bondBonusBp,"12500");
  assert.deepEqual(result.draft.stats,["90","80","70","20","60","10"]);
  assert.equal(result.draft.equipment.gear[0].id,9001);
  assert.deepEqual(result.draft.equipment.gear[0].affixes,[1,2]);
  assert.equal(result.draft.equipment.cards[0].flash,true);
  assert.equal(result.draft.skillIds,"1160805, 1161103");
  assert.equal(result.draft.disabledRotationIds,"1161103");
  assert.equal(result.draft.duration,"45000");
  assert.equal(result.draft.simulationRuns,"5000");
  assert.equal(result.draft.simulationSeed,"123456");
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
  assert.ok(result.warnings.some((item)=>item.includes("bonus stat points were preserved")));
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

test("legacy import golden fixture preserves character sources and seeded damage-report parity",async()=>{
  const state={
    v:15,job:1410,level:150,element:4,bonus:{boss:125},stats:[90,80,70,20,60,10],
    skills:{11608:5,11611:5,11636:5},rotation:[11608,11611,11636],
    sim:{seconds:10,runs:128,seed:20261126,cycle:0,cancel:0,howl:0},
    target:{def:1980,mdef:1200,level:200,element:2,race:3,size:1},
    ex:{103:100,1:12,1031:450},petCollect:[[104,50]],
    echoUseEntries:true,echoes:[{id:501,stats:[{a:105,v:25}],colors:["red"]}],
    totemLv:4,totems:[{id:7001,attrs:[[103,30]],skills:[9001]}],
  };
  const skillOptions=[
    {groupId:11608,id:1160805,level:5},
    {groupId:11611,id:1161105,level:5},
    {groupId:11636,id:1163605,level:5},
  ];
  const imported=importLegacyRoyalGuardBuild(state,defaults,skillOptions);
  assert.ok(imported.draft);
  assert.equal(imported.draft.bonusStatPoints,"-48");
  const pairs=(value)=>value.split(",").filter(Boolean).map((entry)=>entry.trim().split(":").map(Number));
  const skillLevels=Object.fromEntries(imported.draft.skillLevels.split(",").filter(Boolean).map((entry)=>entry.trim().split(":").map(Number)));
  const rotationIds=imported.draft.skillIds.split(",").filter(Boolean).map(Number);
  const data=await createRo3CombatDataStore();
  const totemEnhanceBp=Number(data.row("TotemLvConfig",Number(imported.draft.totemLevel))?._iAttributeEnhance ?? 0);
  const nativeTotems=JSON.parse(imported.draft.totemLoadoutInput).map((totem)=>({...totem,enhanceBp:totemEnhanceBp}));
  for(const id of [1160805,1161105,1163605]) assert.ok(data.row("SkillConfig",id),`fixture skill ${id} should exist in exported simulator data`);
  const nativeBuild={
    career:1410,level:Number(imported.draft.level),element:Number(imported.draft.attackerElement),bondBonusBp:Number(imported.draft.bondBonusBp),stats:imported.draft.stats.map(Number),
    equipmentAttrs:pairs(imported.draft.extraAttrInput),
    extraAttrs:pairs(imported.draft.petCollectionAttrInput),
    emblemAttrs:pairs(imported.draft.emblemAttrInput),
    totems:nativeTotems,
    skillLevels,rotationCycle:imported.draft.rotationCycle,cancelBackswing:imported.draft.cancelBackswing,
    periodicOff:imported.draft.periodicOff,periodicStartMs:Number(imported.draft.periodicStartSeconds)*1000,ridden:imported.draft.ridden,
  };
  // Reference shape follows the upstream currentBuild() mapping: ex -> equipmentAttrs,
  // petCollect -> extraAttrs, Echo rolls -> emblemAttrs, deployed Totems -> totems,
  // and learned levels / rotation groups -> the same supported SkillConfig rows.
  const legacyReference={
    career:1410,level:150,element:4,bondBonusBp:12500,stats:[90,80,70,20,60,10],
    equipmentAttrs:[[1,12],[103,100],[1031,450]],
    extraAttrs:[[104,50]],emblemAttrs:[[105,25]],
    totems:[{guid:1,id:7001,attrs:[[103,30]],skills:[9001],enhanceBp:totemEnhanceBp}],
    skillLevels:{11608:5,11611:5,11636:5},rotationCycle:false,cancelBackswing:false,
    periodicOff:false,periodicStartMs:0,ridden:false,
  };
  assert.deepEqual(buildCharacterStats(nativeBuild,data),buildCharacterStats(legacyReference,data));
  const defender={level:Number(imported.draft.targetLevel),def:Number(imported.draft.def),mdef:Number(imported.draft.mdef),element:Number(imported.draft.element),race:Number(imported.draft.race),size:Number(imported.draft.size)};
  const durationMs=Number(imported.draft.duration);
  const options={runs:Number(imported.draft.simulationRuns),seed:Number(imported.draft.simulationSeed),bins:72,bucketMs:1000,captureRun:true};
  const legacyDefender={level:200,def:1980,mdef:1200,element:2,race:3,size:1};
  const nativeReport=simulateDistribution(nativeBuild,defender,rotationIds,durationMs,options,data);
  const legacyReport=simulateDistribution(legacyReference,legacyDefender,[1160805,1161105,1163605],durationMs,options,data);
  assert.deepEqual(nativeReport.deterministic.castLog,legacyReport.deterministic.castLog);
  assert.deepEqual(nativeReport.deterministic.sampleTimeline,legacyReport.deterministic.sampleTimeline);
  assert.deepEqual(Array.from(nativeReport.totals),Array.from(legacyReport.totals));
  assert.deepEqual(nativeReport.skills.map((skill)=>[skill.id,skill.total,skill.hits,skill.crits,skill.misses,Array.from(skill.normalBins),Array.from(skill.critBins)]),
    legacyReport.skills.map((skill)=>[skill.id,skill.total,skill.hits,skill.crits,skill.misses,Array.from(skill.normalBins),Array.from(skill.critBins)]));
  assert.deepEqual(nativeReport.sampleRun,legacyReport.sampleRun);
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
