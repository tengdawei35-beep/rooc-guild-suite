import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";

export type RooStats = Record<string, string>;
type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
type Roi = { x: number; y: number; width: number; height: number };

const PVP_ROIS: Record<string, Roi> = {
  pvpDamageReduction: { x: 0.30, y: 0.885, width: 0.22, height: 0.085 },
  pvpDamageBonus: { x: 0.79, y: 0.885, width: 0.20, height: 0.085 },
};

const LABELS: Record<string, string[]> = {
  patk:["PATK","PHYSICAL ATTACK"], matk:["MATK","MAGIC ATTACK"], hp:["HP","HEALTH POINTS"],
  pdmgPercent:["PDMG"], mdmgPercent:["MDMG"], pdmgReductionPercent:["PDMG.R","PDMG REDUCTION"], mdmgReductionPercent:["MDMG.R","MDMG REDUCTION"],
  critRes:["CRIT RES","CRIT RES."], ignorePdef:["IGNORE PDEF","IGNORE P DEF","IGNORE P-DEF"], ignoreMdef:["IGNORE MDEF","IGNORE M DEF","IGNORE M-DEF"],
  pdmgBonus:["PDMG BONUS"], mdmgBonus:["MDMG BONUS"], pveDamageReduction:["PVE DMG REDUCTION","PVE DMG RED"], pveDamageBonus:["PVE DMG BONUS","PVE DMG BON"],
  damageVsSmall:["DMG VS SMALL ENEMIES","DMG VS SMALL"], damageReductionVsSmall:["DMG REDUCTION VS SMALL ENEMIES","DMG REDUCTION VS SMALL"],
  damageVsMedium:["DMG VS MEDIUM ENEMIES","DMG VS MEDIUM"], damageReductionVsMedium:["DMG REDUCTION VS MEDIUM ENEMIES","DMG REDUCTION VS MEDIUM"],
  damageVsLarge:["DMG VS LARGE ENEMIES","DMG VS LARGE"], damageReductionVsLarge:["DMG REDUCTION VS LARGE MONSTERS","DMG REDUCTION VS LARGE"],
  damageVsBrute:["DMG VS BRUTE"], damageReductionVsBrute:["DMG REDUCTION VS BRUTE"], damageVsDemiHuman:["DMG VS DEMI-HUMAN","DMG VS DEMIHUMAN"], damageReductionVsDemiHuman:["DMG REDUCTION VS DEMI-HUMAN","DMG REDUCTION VS DEMIHUMAN"],
  equipmentPdefPercent:["EQUIPMENT PDEF"], equipmentMdefPercent:["EQUIPMENT MDEF"]
};

function normalise(text:string){return text.toUpperCase().replace(/[|]/g,"I").replace(/\s+/g," ").trim();}
function firstNumber(text:string){return text.replace(/,/g,"").match(/-?\d+(?:\.\d+)?%?/)?.[0]??null;}
function allNumbers(text:string){return [...text.replace(/,/g,"").matchAll(/-?\d+(?:\.\d+)?%?/g)].map(m=>m[0]);}
function exactLabelRegex(alias:string){const e=alias.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");return new RegExp(`(^|[^A-Z0-9])${e}(?=$|[^A-Z0-9])`,"i");}
function findExactLabel(line:string,field:string,aliases:string[]){const u=normalise(line);for(const a of aliases.slice().sort((x,y)=>y.length-x.length)){const m=exactLabelRegex(a).exec(u);if(!m)continue;const before=u.slice(0,m.index);if((field==="patk"||field==="matk")&&/REFINE\s*$/.test(before))continue;if(field==="hp"&&/HP\s+RECOVER/i.test(u))continue;if(field==="pdmgPercent"&&/PDMG\s*\.\s*R/i.test(u))continue;if(field==="mdmgPercent"&&/MDMG\s*\.\s*R/i.test(u))continue;if(field==="pdmgReductionPercent"&&!/PDMG\s*\.\s*R/i.test(u))continue;if(field==="mdmgReductionPercent"&&!/MDMG\s*\.\s*R/i.test(u))continue;return m.index+m[0].length;}return-1;}
function extractLabelValues(text:string):RooStats{const r:RooStats={};for(const line of text.split(/\r?\n/).map(normalise).filter(Boolean)){for(const[field,aliases]of Object.entries(LABELS)){const end=findExactLabel(line,field,aliases);if(end<0)continue;const v=firstNumber(line.slice(end));if(v===null)continue;if((field==="equipmentPdefPercent"||field==="equipmentMdefPercent")&&!v.endsWith("%"))continue;if((field==="ignorePdef"||field==="ignoreMdef")&&v.endsWith("%"))continue;if((field==="pdmgPercent"||field==="mdmgPercent"||field.endsWith("ReductionPercent"))&&!v.endsWith("%"))continue;r[field]=v.replace(/%$/," ").trim();}}return r;}
async function preprocess(image:Buffer,mode:"normal"|"contrast"|"threshold"){let p=sharp(image).rotate().resize({width:2200,withoutEnlargement:false}).grayscale().normalize();if(mode==="contrast")p=p.linear(1.45,-40);if(mode==="threshold")p=p.linear(1.7,-70).threshold(200);return p.sharpen().png().toBuffer();}
async function preprocessRoi(image:Buffer,region:Roi){const m=await sharp(image).metadata(),w=Number(m.width??0),h=Number(m.height??0);if(!w||!h)throw new Error("Unable to determine screenshot dimensions.");const left=Math.max(0,Math.min(Math.round(w*region.x),w-1)),top=Math.max(0,Math.min(Math.round(h*region.y),h-1));const cw=Math.max(1,Math.min(Math.round(w*region.width),w-left)),ch=Math.max(1,Math.min(Math.round(h*region.height),h-top));return sharp(image).rotate().extract({left,top,width:cw,height:ch}).resize({width:1000}).grayscale().normalize().linear(1.6,-45).threshold(185).sharpen().png().toBuffer();}
async function recognise(worker:OcrWorker,image:Buffer,psm:PSM,whitelist?:string){await worker.setParameters({tessedit_pageseg_mode:psm,...(whitelist?{tessedit_char_whitelist:whitelist}:{}),preserve_interword_spaces:"1",user_defined_dpi:"300"});return String((await worker.recognize(image)).data.text??"");}
export async function readRooStats(images:Buffer[]):Promise<{stats:RooStats;rawText:string}>{if(!images.length)throw new Error("At least one screenshot is required.");if(images.length>12)throw new Error("A maximum of 12 screenshots can be read at once.");const worker=await createWorker("eng",1),numericWorker=await createWorker("eng",1);const stats:RooStats={},raw:string[]=[];try{for(const image of images){const variants=await Promise.all([preprocess(image,"normal"),preprocess(image,"contrast"),preprocess(image,"threshold")]);for(const v of variants){const text=await recognise(worker,v,PSM.SINGLE_BLOCK);raw.push(text);Object.assign(stats,extractLabelValues(text));}for(const text of raw.slice(-3)){const p=text.match(/EQUIPMENT\s*PDEF\s*[:]?\s*(\d+(?:\.\d+)?)(?!\s*%)/i),m=text.match(/EQUIPMENT\s*MDEF\s*[:]?\s*(\d+(?:\.\d+)?)(?!\s*%)/i);if(p)stats.pdef=p[1];if(m)stats.mdef=m[1];}for(const[field,roi]of Object.entries(PVP_ROIS)){const crop=await preprocessRoi(image,roi);const text=await recognise(numericWorker,crop,PSM.SINGLE_LINE,"0123456789");const nums=allNumbers(text);if(nums.length)stats[field]=nums.sort((a,b)=>b.replace(/\D/g,"").length-a.replace(/\D/g,"").length)[0];}}}finally{await Promise.allSettled([worker.terminate(),numericWorker.terminate()]);}return{stats,rawText:raw.join("\n")};}
export default readRooStats;
