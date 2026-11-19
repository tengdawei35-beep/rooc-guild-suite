import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
export const RO3_STAT_KEYS = ["hp","patk","matk","pdef","mdef","healingDonePercent","critDamagePercent","critDamageReductionPercent","physicalDamageBonusPercent","physicalDamageReductionPercent","magicDamageBonusPercent","magicDamageReductionPercent","damageIncreasePercent","damageReductionPercent","physicalPenetrationPercent","magicPenetrationPercent","damageVsAllJob","damageReductionVsAllJob","damageVsMedium","damageReductionVsMedium","bladeCrystal","shieldCrystal","manaCrystal","magicDefCrystal"] as const;
export type RO3StatKey=typeof RO3_STAT_KEYS[number];
export type RO3Stats=Partial<Record<RO3StatKey,string>>;
const LABELS:Record<RO3StatKey,string[]> = {
hp:["HP"],patk:["PATK"],matk:["MATK"],pdef:["PDEF"],mdef:["MDEF"],healingDonePercent:["HEALING DONE","HEALING DONE %"],critDamagePercent:["CRIT DAMAGE","CRIT DAMAGE %"],critDamageReductionPercent:["CRIT DAMAGE REDUCTION","CRIT DAMAGE REDUCTION %"],physicalDamageBonusPercent:["PHYSICAL DAMAGE BONUS","PHYSICAL DAMAGE BONUS %"],physicalDamageReductionPercent:["PHYSICAL DAMAGE REDUCTION","PHYSICAL DAMAGE REDUCTION %"],magicDamageBonusPercent:["MAGIC DAMAGE BONUS","MAGIC DAMAGE BONUS %"],magicDamageReductionPercent:["MAGIC DAMAGE REDUCTION","MAGIC DAMAGE REDUCTION %"],damageIncreasePercent:["DAMAGE INCREASE","DAMAGE INCREASE %"],damageReductionPercent:["DAMAGE REDUCTION","DAMAGE REDUCTION %"],physicalPenetrationPercent:["PHYSICAL PENETRATION","PHYSICAL PENETRATION %","PENETRATION P"],magicPenetrationPercent:["MAGIC PENETRATION","MAGIC PENETRATION %","PENETRATION M"],damageVsAllJob:["DMG VS ALL JOB","DAMAGE VS ALL JOB"],damageReductionVsAllJob:["DMG REDUCTION VS ALL JOB","DAMAGE REDUCTION VS ALL JOB"],damageVsMedium:["DMG VS MEDIUM","DAMAGE VS MEDIUM"],damageReductionVsMedium:["DMG REDUCTION VS MEDIUM","DAMAGE REDUCTION VS MEDIUM"],bladeCrystal:["BLADE CRYSTAL"],shieldCrystal:["SHIELD CRYSTAL"],manaCrystal:["MANA CRYSTAL"],magicDefCrystal:["MAGIC DEF CRYSTAL"]};
const norm=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9% .-]/g," ").replace(/\s+/g," ").trim();
const num=(s:string)=>s.replace(/,/g,"").replace(/[Oo]/g,"0").replace(/[Il|]/g,"1").trim();
const percentKeys=new Set<RO3StatKey>(["healingDonePercent","critDamagePercent","critDamageReductionPercent","physicalDamageBonusPercent","physicalDamageReductionPercent","magicDamageBonusPercent","magicDamageReductionPercent","damageIncreasePercent","damageReductionPercent","physicalPenetrationPercent","magicPenetrationPercent"]);
function find(text: string): RO3Stats {
  const out: RO3Stats = {};

  for (const line of text.split(/\\r?\\n/)) {
    const normalizedLine = norm(line);

    for (const [key, aliases] of Object.entries(LABELS) as [RO3StatKey, string[]][]) {
      for (const alias of aliases) {
        const normalizedAlias = norm(alias);
        const index = normalizedLine.indexOf(normalizedAlias);
        if (index < 0) continue;

        // Special Dish crystal quantities are displayed immediately BEFORE
        // the crystal name in the game UI (e.g. "0 Blade Crystal"). They are
        // not the "Uses Remaining: 50/50" counter shown on the right.
        if (["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"].includes(key)) {
          const prefix = normalizedLine.slice(0, index);
          const matches = [...prefix.matchAll(/(?:^|\\s)(\\d{1,2})(?=\\s|$)/g)];
          const displayedValue = matches.at(-1)?.[1];
          if (displayedValue !== undefined) {
            const parsed = Number(num(displayedValue));
            if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 50) out[key] = String(parsed);
          }
          break;
        }

        const valueText = normalizedLine.slice(index + normalizedAlias.length);
        const match = valueText.match(/[-+]?\\d[\\d,.]*%?/);
        if (!match) continue;
        if (percentKeys.has(key) && !match[0].includes("%")) continue;

        const parsed = num(match[0]).replace(/%/g, "");
        if (parsed) out[key] = parsed;
        break;
      }
    }
  }

  return out;
}

export async function readRO3Stats(images:Buffer[]):Promise<{stats:RO3Stats;rawText:string}>{if(!images.length)throw new Error("At least one screenshot is required.");if(images.length>12)throw new Error("A maximum of 12 screenshots can be read at once.");const worker=await createWorker("eng",1);try{const texts:string[]=[];for(const image of images){const processed=await sharp(image).rotate().resize({width:2200}).grayscale().normalize().sharpen().png().toBuffer();await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:"1",user_defined_dpi:"300"});texts.push(String((await worker.recognize(processed)).data.text??""));await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,preserve_interword_spaces:"1",user_defined_dpi:"300"});texts.push(String((await worker.recognize(processed)).data.text??""));}const rawText=texts.join("\n");return{stats:find(rawText),rawText};}finally{await worker.terminate();}}
