import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";

export type RooStats = Record<string, string>;
type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
type Roi = { x: number; y: number; width: number; height: number };

const PVP_ROIS: Record<string, Roi> = {
  pvpDamageReduction: { x: 0.30, y: 0.85, width: 0.22, height: 0.12 },
  pvpDamageBonus: { x: 0.76, y: 0.85, width: 0.24, height: 0.12 },
};

const LABELS: Record<string, string[]> = {
  patk:["PATK","PHYSICAL ATTACK"], matk:["MATK","MAGIC ATTACK"], hp:["HP","HEALTH POINTS"],
  pdmgPercent:["PDMG"], mdmgPercent:["MDMG"], pdmgReductionPercent:["PDMG.R","PDMG R","PDMG-R"], mdmgReductionPercent:["MDMG.R","MDMG R","MDMG-R"],
  critRes:["CRIT RES","CRIT RES."], ignorePdef:["IGNORE PDEF","IGNORE P DEF","IGNORE P-DEF","lenore PDEF"], ignoreMdef:["IGNORE MDEF","IGNORE M DEF","IGNORE M-DEF","lenore MDEF"],
  pdmgBonus:["PDMG BONUS"], mdmgBonus:["MDMG BONUS"], pveDamageReduction:["PVE DMG REDUCTION","PVE DMG RED","VE DMG RED"], pveDamageBonus:["PVE DMG BONUS","PVE DMG BON"],
  damageVsSmall:["DMG VS SMALL ENEMIES","DMG VS SMALL"], damageReductionVsSmall:["DMG REDUCTION VS SMALL ENEMIES","DMG REDUCTION VS SMALL"],
  damageVsMedium:["DMG VS MEDIUM ENEMIES","DMG VS MEDIUM"], damageReductionVsMedium:["DMG REDUCTION VS MEDIUM ENEMIES","DMG REDUCTION VS MEDIUM"],
  damageVsLarge:["DMG VS LARGE ENEMIES","DMG VS LARGE"], damageReductionVsLarge:["DMG REDUCTION VS LARGE MONSTERS","DMG REDUCTION VS LARGE"],
  damageVsBrute:["DMG VS BRUTE"], damageReductionVsBrute:["DMG REDUCTION VS BRUTE"], damageVsDemiHuman:["DMG VS DEMI-HUMAN","DMG VS DEMIHUMAN"], damageReductionVsDemiHuman:["DMG REDUCTION VS DEMI-HUMAN","DMG REDUCTION VS DEMIHUMAN"],
  equipmentPdefPercent:["EQUIPMENT PDEF"], equipmentMdefPercent:["EQUIPMENT MDEF"]
};

function normalise(text:string){return text.toUpperCase().replace(/[“”‘’]/g,"").replace(/\s+/g," ").trim();}
function repairNumber(text:string){return text.replace(/,/g,"").replace(/[Oo]/g,"0").replace(/[Il|]/g,"1").trim();}
function firstNumber(text:string){return text.replace(/,/g,"").match(/-?\d+(?:\.\d+)?%?/)?.[0]??null;}
function allNumbers(text:string){return [...text.replace(/,/g,"").matchAll(/\d+(?:\.\d+)?/g)].map(m=>m[0]);}
function exactLabelRegex(alias:string){const e=alias.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");return new RegExp(`(^|[^A-Z0-9])${e}(?=$|[^A-Z0-9])`,"i");}

function findExactLabel(line:string,field:string,aliases:string[]){
  const upper=normalise(line);
  for(const alias of aliases.slice().sort((a,b)=>b.length-a.length)){
    const match=exactLabelRegex(alias).exec(upper); if(!match) continue;
    const before=upper.slice(0,match.index);
    if((field==="patk"||field==="matk")&&/REFINE\s*$/.test(before)) continue;
    if(field==="hp"&&/HP\s+RECOVER/i.test(upper)) continue;
    if(field==="pdmgPercent"&&/PDMG\s*\.\s*R/i.test(upper)) continue;
    if(field==="mdmgPercent"&&/MDMG\s*\.\s*R/i.test(upper)) continue;
    if(field==="pdmgReductionPercent"&&!/PDMG\s*\.\s*R/i.test(upper)) continue;
    if(field==="mdmgReductionPercent"&&!/MDMG\s*\.\s*R/i.test(upper)) continue;
    if((field==="ignorePdef"||field==="ignoreMdef")&&/%/.test(upper.slice(match.index))) continue;
    if(field==="equipmentPdefPercent"&&!/EQUIPMENT\s+PDEF/i.test(upper)) continue;
    if(field==="equipmentMdefPercent"&&!/EQUIPMENT\s+MDEF/i.test(upper)) continue;
    return match.index+match[0].length;
  }
  return -1;
}

function extractLabelValues(text:string):RooStats{
  const r:RooStats={};
  for(const line of text.split(/\r?\n/).map(normalise).filter(Boolean)){
    for(const [field,aliases] of Object.entries(LABELS)){
      const end=findExactLabel(line,field,aliases); if(end<0) continue;
      const value=firstNumber(line.slice(end)); if(value===null) continue;
      if((field==="equipmentPdefPercent"||field==="equipmentMdefPercent")&&!value.endsWith("%")) continue;
      if((field==="ignorePdef"||field==="ignoreMdef")&&value.endsWith("%")) continue;
      if((field==="pdmgPercent"||field==="mdmgPercent"||field==="pdmgReductionPercent"||field==="mdmgReductionPercent")&&!value.endsWith("%")) continue;
      if(field==="pdmgBonus"||field==="mdmgBonus"||field==="pveDamageReduction"||field==="pveDamageBonus"){
        // These are absolute values in the ROO Quasi-Stats screen.
      }
      r[field]=repairNumber(value).replace(/%$/," ").trim();
    }
  }
  return r;
}

async function preprocess(image:Buffer,mode:"normal"|"contrast"|"threshold"){
  let p=sharp(image).rotate().resize({width:2200,withoutEnlargement:false}).grayscale().normalize();
  if(mode==="contrast")p=p.linear(1.45,-40);
  if(mode==="threshold")p=p.linear(1.7,-70).threshold(200);
  return p.sharpen().png().toBuffer();
}

async function preprocessRoi(image:Buffer,region:Roi){
  const m=await sharp(image).metadata(),w=Number(m.width??0),h=Number(m.height??0); if(!w||!h)throw new Error("Unable to determine screenshot dimensions.");
  const left=Math.max(0,Math.min(Math.round(w*region.x),w-1)),top=Math.max(0,Math.min(Math.round(h*region.y),h-1));
  const width=Math.max(1,Math.min(Math.round(w*region.width),w-left)),height=Math.max(1,Math.min(Math.round(h*region.height),h-top));
  return sharp(image).rotate().extract({left,top,width,height}).resize({width:1600,withoutEnlargement:false}).grayscale().normalize().linear(1.3,-20).sharpen().png().toBuffer();
}

async function recognise(worker:OcrWorker,image:Buffer,psm:PSM,whitelist?:string){
  await worker.setParameters({tessedit_pageseg_mode:psm,...(whitelist?{tessedit_char_whitelist:whitelist}:{}),preserve_interword_spaces:"1",user_defined_dpi:"300"});
  return String((await worker.recognize(image)).data.text??"");
}

function choosePvpNumber(texts:string[], expectedMinLength:number){
  const candidates:string[]=[];
  for(const text of texts){
    for(const n of allNumbers(text)){ if(n.length>=expectedMinLength) candidates.push(n); }
  }
  if(!candidates.length) return null;
  const counts:Record<string,number>={}; for(const c of candidates) counts[c]=(counts[c]||0)+1;
  return [...new Set(candidates)].sort((a,b)=>counts[b]-counts[a]||b.length-a.length)[0];
}

export async function readRooStats(images:Buffer[]):Promise<{stats:RooStats;rawText:string}>{
  if(!images.length)throw new Error("At least one screenshot is required."); if(images.length>12)throw new Error("A maximum of 12 screenshots can be read at once.");
  const worker=await createWorker("eng",1),numericWorker=await createWorker("eng",1); const stats:RooStats={},raw:string[]=[];
  try{
    for(const image of images){
      const variants=await Promise.all([preprocess(image,"normal"),preprocess(image,"contrast"),preprocess(image,"threshold")]);
      for(const v of variants){const text=await recognise(worker,v,PSM.SINGLE_BLOCK); raw.push(text); Object.assign(stats,extractLabelValues(text));}
      const pvpTexts:Record<string,string[]>={pvpDamageReduction:[],pvpDamageBonus:[]};
      for(const [field,roi] of Object.entries(PVP_ROIS)){
        const crop=await preprocessRoi(image,roi);
        for(let pass=0;pass<3;pass++){
          const text=await recognise(numericWorker,crop,PSM.SINGLE_LINE,"0123456789"); pvpTexts[field].push(text);
        }
      }
      const reduction=choosePvpNumber(pvpTexts.pvpDamageReduction,4); const bonus=choosePvpNumber(pvpTexts.pvpDamageBonus,4);
      if(reduction)stats.pvpDamageReduction=reduction;
      if(bonus)stats.pvpDamageBonus=bonus;
      const notice=raw.slice(-3).join("\n");
      const p=notice.match(/EQUIPMENT\s*PDEF\s*[:]?\s*(\d+(?:\.\d+)?)(?!\s*%)/i); if(p)stats.pdef=repairNumber(p[1]);
      const m=notice.match(/EQUIPMENT\s*MDEF\s*[:]?\s*(\d+(?:\.\d+)?)(?!\s*%)/i); if(m)stats.mdef=repairNumber(m[1]);
    }
  }finally{await Promise.allSettled([worker.terminate(),numericWorker.terminate()]);}
  return{stats,rawText:raw.join("\n")};
}
export default readRooStats;
