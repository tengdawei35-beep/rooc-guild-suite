import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";

export type RooStats = Record<string, string>;
type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

const LABELS: Record<string, string[]> = {
  patk: ["PATK"], matk: ["MATK"], hp: ["HP"], pdmgPercent: ["PDMG"], mdmgPercent: ["MDMG"],
  pdmgReductionPercent: ["PDMG.R", "PDMG R", "PDMG-R", "PHYSICAL DAMAGE REDUCTION"], mdmgReductionPercent: ["MDMG.R", "MDMG R", "MDMG-R", "MAGIC DAMAGE REDUCTION"],
  critRes: ["CRIT RES", "CRIT RES."], ignorePdef: ["IGNORE PDEF", "IGNORE P DEF", "IGNORE P-DEF", "LENORE PDEF"], ignoreMdef: ["IGNORE MDEF", "IGNORE M DEF", "IGNORE M-DEF", "LENORE MDEF"],
  pdmgBonus: ["PDMG BONUS", "P DMG BONUS", "PHYSICAL DAMAGE BONUS"], mdmgBonus: ["MDMG BONUS", "M DMG BONUS", "MAGIC DAMAGE BONUS"], pveDamageReduction: ["PVE DMG REDUCTION", "PVE DMG RED", "VE DMG RED"], pveDamageBonus: ["PVE DMG BONUS", "PVE DMG BON"],
  damageVsSmall: ["DMG VS SMALL ENEMIES", "DMG VS SMALL"], damageReductionVsSmall: ["DMG REDUCTION VS SMALL ENEMIES", "DMG REDUCTION VS SMALL"], damageVsMedium: ["DMG VS MEDIUM ENEMIES", "DMG VS MEDIUM"], damageReductionVsMedium: ["DMG REDUCTION VS MEDIUM ENEMIES", "DMG REDUCTION VS MEDIUM"],
  damageVsLarge: ["DMG VS LARGE ENEMIES", "DMG VS LARGE"], damageReductionVsLarge: ["DMG REDUCTION VS LARGE MONSTERS", "DMG REDUCTION VS LARGE"], damageVsBrute: ["DMG VS BRUTE"], damageReductionVsBrute: ["DMG REDUCTION VS BRUTE"], damageVsDemiHuman: ["DMG VS DEMI-HUMAN", "DMG VS DEMIHUMAN"], damageReductionVsDemiHuman: ["DMG REDUCTION VS DEMI-HUMAN", "DMG REDUCTION VS DEMIHUMAN"],
  equipmentPdefPercent: ["EQUIPMENT PDEF"], equipmentMdefPercent: ["EQUIPMENT MDEF"]
};
function normalise(text:string){return text.toUpperCase().replace(/[“”‘’]/g,"").replace(/\s+/g," ").trim();}
function repairNumber(text:string){return text.replace(/,/g,"").replace(/[Oo]/g,"0").replace(/[Il|]/g,"1").trim();}
function numberMatches(text:string){return [...text.replace(/,/g,"").matchAll(/-?\d+(?:\.\d+)?%?/g)];}
function escaped(alias:string){return alias.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s*");}
function extractAfterAlias(line:string,alias:string){const re=new RegExp(`(?:^|[^A-Z0-9])${escaped(alias)}(?=$|[^A-Z0-9])`,`ig`);let match:RegExpExecArray|null;while((match=re.exec(line))){const start=match.index+match[0].length;const suffix=line.slice(start);const n=numberMatches(suffix)[0];if(n)return{value:repairNumber(n[0]),start,numberIndex:start+(n.index??0)};}return null;}
function extractLabelValues(text:string):RooStats{const result:RooStats={};for(const raw of text.split(/\r?\n/)){const line=normalise(raw);for(const[field,aliases]of Object.entries(LABELS))for(const alias of aliases){const found=extractAfterAlias(line,alias);if(!found)continue;const value=found.value;const before=line.slice(0,found.start);if((field==="patk"||field==="matk")&&/REFINE\s+(?:PATK|MATK)/i.test(before))continue;if(field==="hp"&&(/HP\s+RECOVER/i.test(before)||/HP\s+RECOVER/i.test(line)))continue;if((field==="pdmgPercent"||field==="mdmgPercent")&&/(?:PDMG|MDMG)\s*[.]\s*R/i.test(line.slice(found.start-2,found.start+4)))continue;if((field==="pdmgReductionPercent"||field==="mdmgReductionPercent")&&!/%$/.test(value))continue;if((field==="pdmgPercent"||field==="mdmgPercent")&&!/%$/.test(value))continue;if((field==="equipmentPdefPercent"||field==="equipmentMdefPercent")&&!/%$/.test(value))continue;if((field==="ignorePdef"||field==="ignoreMdef")&&/%$/.test(value))continue;result[field]=value.replace(/%$/," ").trim();break;}}return result;}
async function preprocess(image:Buffer,mode:"normal"|"contrast"|"threshold"){let p=sharp(image).rotate().resize({width:2200,withoutEnlargement:false}).grayscale().normalize();if(mode==="contrast")p=p.linear(1.45,-40);if(mode==="threshold")p=p.linear(1.7,-70).threshold(200);return p.sharpen().png().toBuffer();}
async function recognise(worker:OcrWorker,image:Buffer,psm:PSM,whitelist?:string){await worker.setParameters({tessedit_pageseg_mode:psm,...(whitelist?{tessedit_char_whitelist:whitelist}:{}),preserve_interword_spaces:"1",user_defined_dpi:"300"});return String((await worker.recognize(image)).data.text??"");}
function extractPvpFromText(texts:string[]){const result:RooStats={};const reductionPatterns=[/(?:PVP|2VP|>VP|\?VP)\s*DMG\s*RED(?:UCTION|U)?[^0-9]{0,24}(\d{3,6})/gi,/[>2]?V?P\s*DMG\s*RED[^0-9]{0,24}(\d{3,6})/gi];
 // The game label is sometimes OCR'd as "P DMG Bonus" or "~ P DMG Bonus". Require whitespace between P and DMG so this cannot match the ordinary "PDMG Bonus 360" stat.
 const bonusPatterns=[/(?:PVP|2VP|>VP|\?VP)\s*DMG\s*BON(?:US)?[^0-9]{0,24}(\d{3,6})/gi,/[>2"~“”]?\s*P\s+DMG\s+BON(?:US)?[^0-9]{0,24}(\d{3,6})/gi];
 const candidates=(patterns:RegExp[])=>texts.flatMap(text=>patterns.flatMap(re=>[...normalise(text).matchAll(re)].map(m=>repairNumber(m[1]))));
 for(const[key,values]of[["pvpDamageReduction",candidates(reductionPatterns)],["pvpDamageBonus",candidates(bonusPatterns)]]as const){if(!values.length)continue;const counts:Record<string,number>={};values.forEach(v=>counts[v]=(counts[v]??0)+1);result[key]=[...new Set(values)].sort((a,b)=>counts[b]-counts[a]||b.length-a.length)[0];}return result;}
type PvpKey = "pvpDamageReduction" | "pvpDamageBonus";
type PvpCandidate = { value: string; confidence: number };

const PVP_POSITIONAL_ROIS = {
  pvpDamageReduction: { x: 0.30, y: 0.885, width: 0.22, height: 0.085 },
  pvpDamageBonus: { x: 0.79, y: 0.885, width: 0.20, height: 0.085 },
} as const;

function isQuasiStatsScreenshot(text: string, width: number, height: number) {
  const normalized = normalise(text).replace(/[^A-Z0-9]/g, "");
  const hasQuasiMarkers =
    normalized.includes("QUASISTATS") ||
    (normalized.includes("PDMG") && normalized.includes("MDMG") && normalized.includes("IGNOREPDEF"));
  const ratio = width > 0 && height > 0 ? width / height : 0;
  return hasQuasiMarkers || (ratio >= 0.85 && ratio <= 1.05);
}

function choosePositionalCandidate(candidates: PvpCandidate[]) {
  if (!candidates.length) return null;
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.value, (counts.get(candidate.value) ?? 0) + 1);
  }
  return [...candidates].sort((a, b) =>
    (counts.get(b.value)! - counts.get(a.value)!) ||
    (b.confidence - a.confidence)
  )[0]?.value ?? null;
}

async function extractPositionalPvp(worker: OcrWorker, image: Buffer, fullText: string) {
  const oriented = await sharp(image).rotate().png().toBuffer();
  const metadata = await sharp(oriented).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height || !isQuasiStatsScreenshot(fullText, width, height)) return {} as Partial<Record<PvpKey, string>>;

  const candidates: Record<PvpKey, PvpCandidate[]> = {
    pvpDamageReduction: [],
    pvpDamageBonus: [],
  };
  const modes = ["normal", "contrast", "highcontrast", "threshold170", "threshold200", "threshold220"] as const;

  for (const [key, region] of Object.entries(PVP_POSITIONAL_ROIS) as [PvpKey, (typeof PVP_POSITIONAL_ROIS)[PvpKey]][]) {
    const left = Math.max(0, Math.min(Math.round(width * region.x), width - 1));
    const top = Math.max(0, Math.min(Math.round(height * region.y), height - 1));
    const cropWidth = Math.max(1, Math.min(Math.round(width * region.width), width - left));
    const cropHeight = Math.max(1, Math.min(Math.round(height * region.height), height - top));

    for (const mode of modes) {
      let crop = sharp(oriented)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .resize({ width: 1000, withoutEnlargement: false })
        .grayscale()
        .normalize();

      if (mode === "contrast") crop = crop.linear(1.35, -35);
      if (mode === "highcontrast") crop = crop.linear(1.65, -70);
      if (mode === "threshold170") crop = crop.threshold(170);
      if (mode === "threshold200") crop = crop.threshold(200);
      if (mode === "threshold220") crop = crop.threshold(220);

      const processed = await crop.sharpen().png().toBuffer();
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: "0123456789",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const result = await worker.recognize(processed);
      const digitTokens = String(result.data.text ?? "").match(/\d+/g);
      if (!digitTokens?.length) continue;
      const digits = digitTokens.join("");
      if (!/^\d{3,6}$/.test(digits)) continue;
      const value = Number(digits);
      if (!Number.isSafeInteger(value) || value > 1_000_000) continue;

      candidates[key].push({
        value: String(value),
        confidence: Number(result.data.confidence ?? 0),
      });
    }
  }

  const positional: Partial<Record<PvpKey, string>> = {};
  for (const key of Object.keys(candidates) as PvpKey[]) {
    const value = choosePositionalCandidate(candidates[key]);
    if (value !== null) positional[key] = value;
  }
  return positional;
}

export async function readRooStats(images:Buffer[]):Promise<{stats:RooStats;rawText:string}>{if(!images.length)throw new Error("At least one screenshot is required.");if(images.length>12)throw new Error("A maximum of 12 screenshots can be read at once.");const worker=await createWorker("eng",1);let workerTerminated=false;const terminateWorker=async()=>{if(workerTerminated)return;workerTerminated=true;await worker.terminate();};const timeout=setTimeout(()=>{void terminateWorker().catch(error=>console.error("[ROO OCR] Worker timeout termination failed:",error));},120_000);const stats:RooStats={};const raw:string[]=[];const positionalTexts:string[]=[];const positionalImages:Buffer[]=[];try{for(const image of images){const variants=await Promise.all([preprocess(image,"normal"),preprocess(image,"contrast"),preprocess(image,"threshold")]);const screenshotTexts:string[]=[];for(const variant of variants){for(const psm of [PSM.SINGLE_BLOCK,PSM.SPARSE_TEXT]){const text=await recognise(worker,variant,psm);raw.push(text);screenshotTexts.push(text);Object.assign(stats,extractLabelValues(text));}}positionalImages.push(image);positionalTexts.push(screenshotTexts.join("\n"));}Object.assign(stats,extractPvpFromText(raw));for(let index=0;index<positionalImages.length;index++){const positional=await extractPositionalPvp(worker,positionalImages[index],positionalTexts[index]);Object.assign(stats,positional);}const notice=raw.join("\n");const pdef=[...notice.matchAll(/EQUIPMENT\s*PDEF\s*[:：]?\s*(\d{3,6})(?!\s*%)/gi)].map(m=>m[1]);const mdef=[...notice.matchAll(/EQUIPMENT\s*MDEF\s*[:：]?\s*(\d{3,6})(?!\s*%)/gi)].map(m=>m[1]);if(pdef.length)stats.pdef=pdef.sort((a,b)=>Number(b)-Number(a))[0];if(mdef.length)stats.mdef=mdef.sort((a,b)=>Number(b)-Number(a))[0];
 const hpCandidates=raw.flatMap(t=>t.split(/\r?\n/).map(normalise).filter(l=>/^HP\s+\d{4,7}(?:\s+|$)/.test(l)).map(l=>l.match(/^HP\s+(\d{4,7})/)?.[1]).filter((v):v is string=>!!v));
 if(hpCandidates.length){const counts:Record<string,number>={};hpCandidates.forEach(v=>counts[v]=(counts[v]??0)+1);stats.hp=[...new Set(hpCandidates)].sort((a,b)=>counts[b]-counts[a]||Number(b)-Number(a))[0];}
 }finally{clearTimeout(timeout);await terminateWorker();}return{stats,rawText:raw.join("\n")};}
export default readRooStats;