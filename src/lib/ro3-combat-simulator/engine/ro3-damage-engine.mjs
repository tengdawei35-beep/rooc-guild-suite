/**
 * Extracted RO3 combat calculation engine.
 *
 * This file is intentionally a byte-for-byte source extraction (apart from the
 * surrounding HTML marker comments) from ro3-damage-sim.html. Keep formulas
 * unchanged during the React migration. UI and browser globals remain outside
 * this module; the engine is the first migration boundary.
 */
/**
 * RO3 Damage Calculator, Combat Timeline Simulator & Maximum-Damage Build Optimizer
 * Standalone, zero-dependency ES module faithful to `ro3emu-server` (`StatCalculator.cs`,
 * `CharacterService.EntityData.cs`, `CharacterService.Progression.cs`, `CombatService.cs`,
 * `CombatService.Casting.cs`, `CombatService.Effects.cs`, `SkillParameterRules.cs`,
 * `EquipmentStunts.cs`, `TotemEffects.cs`, `DungeonService.Bonds.cs`).
 *
 * Usage:
 *   node ro3-damage-optimizer.mjs --self-test
 *   node ro3-damage-optimizer.mjs --class swordman --level 50 --target baphomet --window 30
 */


export const DEFAULT_CONFIG_DIR = '';
// Client skill templates boiled down by extract-skill-timing.mjs: { scriptShow: [chant, end, interrupt, [hit points]] } (seconds).
export const DEFAULT_TIMING_FILE = '';
const asArray = (v) => (Array.isArray(v) ? v : []);
const asPairs = (v) => (Array.isArray(v) ? v.filter((p) => Array.isArray(p) && p.length >= 2) : []);

// ============================================================================
// 1. Built-in Fallback GameData (extracted from RO3 client DataConfig tables)
// ============================================================================

const FALLBACK_TABLES = {
  AttributeConfig: {
    1: { _iID: 1, _iPreAttri: 1, _iCalculateType: 1, _iDataType: 0, _iPower: 50, name: 'STR' },
    2: { _iID: 2, _iPreAttri: 2, _iCalculateType: 1, _iDataType: 0, _iPower: 50, name: 'AGI' },
    3: { _iID: 3, _iPreAttri: 3, _iCalculateType: 1, _iDataType: 0, _iPower: 50, name: 'VIT' },
    4: { _iID: 4, _iPreAttri: 4, _iCalculateType: 1, _iDataType: 0, _iPower: 50, name: 'INT' },
    5: { _iID: 5, _iPreAttri: 5, _iCalculateType: 1, _iDataType: 0, _iPower: 50, name: 'DEX' },
    6: { _iID: 6, _iPreAttri: 6, _iCalculateType: 1, _iDataType: 0, _iPower: 50, name: 'LUK' },
    11: { _iID: 11, _iPreAttri: 1, _iCalculateType: 2, _iDataType: 1, _iPower: 50 },
    12: { _iID: 12, _iPreAttri: 2, _iCalculateType: 2, _iDataType: 1, _iPower: 50 },
    13: { _iID: 13, _iPreAttri: 3, _iCalculateType: 2, _iDataType: 1, _iPower: 50 },
    14: { _iID: 14, _iPreAttri: 4, _iCalculateType: 2, _iDataType: 1, _iPower: 50 },
    15: { _iID: 15, _iPreAttri: 5, _iCalculateType: 2, _iDataType: 1, _iPower: 50 },
    16: { _iID: 16, _iPreAttri: 6, _iCalculateType: 2, _iDataType: 1, _iPower: 50 },
    71: { _iID: 71, _iPreAttri: 1, _iCalculateType: 3, _iDataType: 0, _iPower: 50 },
    72: { _iID: 72, _iPreAttri: 2, _iCalculateType: 3, _iDataType: 0, _iPower: 50 },
    73: { _iID: 73, _iPreAttri: 3, _iCalculateType: 3, _iDataType: 0, _iPower: 50 },
    74: { _iID: 74, _iPreAttri: 4, _iCalculateType: 3, _iDataType: 0, _iPower: 50 },
    75: { _iID: 75, _iPreAttri: 5, _iCalculateType: 3, _iDataType: 0, _iPower: 50 },
    76: { _iID: 76, _iPreAttri: 6, _iCalculateType: 3, _iDataType: 0, _iPower: 50 },
    81: { _iID: 81, _iPreAttri: 1, _iCalculateType: 4, _iDataType: 1, _iPower: 50 },
    82: { _iID: 82, _iPreAttri: 2, _iCalculateType: 4, _iDataType: 1, _iPower: 50 },
    83: { _iID: 83, _iPreAttri: 3, _iCalculateType: 4, _iDataType: 1, _iPower: 50 },
    84: { _iID: 84, _iPreAttri: 4, _iCalculateType: 4, _iDataType: 1, _iPower: 50 },
    85: { _iID: 85, _iPreAttri: 5, _iCalculateType: 4, _iDataType: 1, _iPower: 50 },
    86: { _iID: 86, _iPreAttri: 6, _iCalculateType: 4, _iDataType: 1, _iPower: 50 },
    101: { _iID: 101, _iPreAttri: 101, _iCalculateType: 1, _iDataType: 0, _iPower: 0.25, name: 'MaxHP' },
    102: { _iID: 102, _iPreAttri: 102, _iCalculateType: 1, _iDataType: 0, _iPower: 0, name: 'MaxSP' },
    103: { _iID: 103, _iPreAttri: 103, _iCalculateType: 1, _iDataType: 0, _iPower: 5, name: 'P.ATK' },
    104: { _iID: 104, _iPreAttri: 104, _iCalculateType: 1, _iDataType: 0, _iPower: 5, name: 'M.ATK' },
    105: { _iID: 105, _iPreAttri: 105, _iCalculateType: 1, _iDataType: 0, _iPower: 5, name: 'P.DEF' },
    106: { _iID: 106, _iPreAttri: 106, _iCalculateType: 1, _iDataType: 0, _iPower: 5, name: 'M.DEF' },
    107: { _iID: 107, _iPreAttri: 107, _iCalculateType: 1, _iDataType: 0, _iPower: 1, name: 'HP Regen' },
    108: { _iID: 108, _iPreAttri: 108, _iCalculateType: 1, _iDataType: 0, _iPower: 0, name: 'SP Regen' },
    109: { _iID: 109, _iPreAttri: 109, _iCalculateType: 1, _iDataType: 0, _iPower: 20, name: 'HIT' },
    110: { _iID: 110, _iPreAttri: 110, _iCalculateType: 1, _iDataType: 0, _iPower: 20, name: 'FLEE' },
    111: { _iID: 111, _iPreAttri: 111, _iCalculateType: 1, _iDataType: 0, _iPower: 1, name: 'CRIT' },
    112: { _iID: 112, _iPreAttri: 112, _iCalculateType: 1, _iDataType: 0, _iPower: 1, name: 'Anti-CRIT' },
    113: { _iID: 113, _iPreAttri: 113, _iCalculateType: 1, _iDataType: 0, _iPower: 0, name: 'Move Speed' },
    114: { _iID: 114, _iPreAttri: 115, _iCalculateType: 2, _iDataType: 2, _iPower: 5, name: 'ASPD %' },
    115: { _iID: 115, _iPreAttri: 115, _iCalculateType: 1, _iDataType: 2, _iPower: 0, name: 'Final ASPD' },
    116: { _iID: 116, _iPreAttri: 116, _iCalculateType: 1, _iDataType: 0, _iPower: 5, name: 'Haste' },
    207: { _iID: 207, _iPreAttri: 207, _iCalculateType: 1, _iDataType: 1, _iPower: 1, name: 'Heal Bonus (bp)' },
    209: { _iID: 209, _iPreAttri: 209, _iCalculateType: 1, _iDataType: 1, _iPower: 1, name: 'Crit DMG Bonus (bp)' },
    210: { _iID: 210, _iPreAttri: 210, _iCalculateType: 1, _iDataType: 1, _iPower: 1, name: 'Crit DMG Reduc (bp)' },
    211: { _iID: 211, _iPreAttri: 211, _iCalculateType: 1, _iDataType: 1, _iPower: 2, name: 'P.DMG Bonus (bp)' },
    213: { _iID: 213, _iPreAttri: 213, _iCalculateType: 1, _iDataType: 1, _iPower: 2, name: 'M.DMG Bonus (bp)' },
    216: { _iID: 216, _iPreAttri: 216, _iCalculateType: 1, _iDataType: 1, _iPower: 2, name: 'DMG Reduc (bp)' },
    227: { _iID: 227, _iPreAttri: 227, _iCalculateType: 1, _iDataType: 1, _iPower: 2, name: 'Melee P.DMG (bp)' },
    229: { _iID: 229, _iPreAttri: 229, _iCalculateType: 1, _iDataType: 1, _iPower: 2, name: 'Ranged P.DMG (bp)' },
    304: { _iID: 304, _iPreAttri: 304, _iCalculateType: 1, _iDataType: 1, _iPower: 1, name: 'Fire DMG (bp)' },
    601: { _iID: 601, _iPreAttri: 601, _iCalculateType: 1, _iDataType: 1, _iPower: 0, name: 'Bond Boss DMG (bp)' },
    602: { _iID: 602, _iPreAttri: 602, _iCalculateType: 1, _iDataType: 1, _iPower: 0, name: 'Bond Boss Reduc (bp)' },
    1011: { _iID: 1011, _iPreAttri: 101, _iCalculateType: 2, _iDataType: 1, _iPower: 4, name: 'MaxHP % (BasePerAdd)' },
    1012: { _iID: 1012, _iPreAttri: 101, _iCalculateType: 4, _iDataType: 1, _iPower: 5.2, name: 'MaxHP % (BuffPerAdd)' },
    1013: { _iID: 1013, _iPreAttri: 101, _iCalculateType: 3, _iDataType: 0, _iPower: 0, name: 'MaxHP Flat (BuffValAdd)' },
    1021: { _iID: 1021, _iPreAttri: 102, _iCalculateType: 2, _iDataType: 1, _iPower: 0, name: 'MaxSP % (BasePerAdd)' },
    1022: { _iID: 1022, _iPreAttri: 102, _iCalculateType: 4, _iDataType: 1, _iPower: 0, name: 'MaxSP % (BuffPerAdd)' },
    1023: { _iID: 1023, _iPreAttri: 102, _iCalculateType: 3, _iDataType: 0, _iPower: 0, name: 'MaxSP Flat (BuffValAdd)' },
    1031: { _iID: 1031, _iPreAttri: 103, _iCalculateType: 2, _iDataType: 1, _iPower: 2, name: 'P.ATK % (BasePerAdd)' },
    1032: { _iID: 1032, _iPreAttri: 103, _iCalculateType: 4, _iDataType: 1, _iPower: 2.6, name: 'P.ATK % (BuffPerAdd)' },
    1033: { _iID: 1033, _iPreAttri: 103, _iCalculateType: 3, _iDataType: 0, _iPower: 0, name: 'P.ATK Flat (BuffValAdd)' },
    1034: { _iID: 1034, _iPreAttri: 103, _iCalculateType: 6, _iDataType: 1, _iPower: 0, name: 'P.ATK % (OtherPerAdd)' },
    1041: { _iID: 1041, _iPreAttri: 104, _iCalculateType: 2, _iDataType: 1, _iPower: 2, name: 'M.ATK % (BasePerAdd)' },
    1042: { _iID: 1042, _iPreAttri: 104, _iCalculateType: 4, _iDataType: 1, _iPower: 2.6, name: 'M.ATK % (BuffPerAdd)' },
    1043: { _iID: 1043, _iPreAttri: 104, _iCalculateType: 3, _iDataType: 0, _iPower: 0, name: 'M.ATK Flat (BuffValAdd)' },
    1044: { _iID: 1044, _iPreAttri: 104, _iCalculateType: 6, _iDataType: 1, _iPower: 0, name: 'M.ATK % (OtherPerAdd)' },
    1051: { _iID: 1051, _iPreAttri: 105, _iCalculateType: 2, _iDataType: 1, _iPower: 1.2 },
    1052: { _iID: 1052, _iPreAttri: 105, _iCalculateType: 4, _iDataType: 1, _iPower: 1.2 },
    1053: { _iID: 1053, _iPreAttri: 105, _iCalculateType: 3, _iDataType: 0, _iPower: 0 },
    1061: { _iID: 1061, _iPreAttri: 106, _iCalculateType: 2, _iDataType: 1, _iPower: 1.2 },
    1062: { _iID: 1062, _iPreAttri: 106, _iCalculateType: 4, _iDataType: 1, _iPower: 1.2 },
    1063: { _iID: 1063, _iPreAttri: 106, _iCalculateType: 3, _iDataType: 0, _iPower: 0 },
    1071: { _iID: 1071, _iPreAttri: 1071, _iCalculateType: 1, _iDataType: 1, _iPower: 16 },
    1081: { _iID: 1081, _iPreAttri: 1081, _iCalculateType: 1, _iDataType: 1, _iPower: 0 },
    1091: { _iID: 1091, _iPreAttri: 109, _iCalculateType: 2, _iDataType: 1, _iPower: 0.16 },
    1092: { _iID: 1092, _iPreAttri: 109, _iCalculateType: 4, _iDataType: 1, _iPower: 0.16 },
    1093: { _iID: 1093, _iPreAttri: 109, _iCalculateType: 3, _iDataType: 0, _iPower: 0 },
    1101: { _iID: 1101, _iPreAttri: 110, _iCalculateType: 2, _iDataType: 1, _iPower: 0.16 },
    1102: { _iID: 1102, _iPreAttri: 110, _iCalculateType: 4, _iDataType: 1, _iPower: 0.16 },
    1103: { _iID: 1103, _iPreAttri: 110, _iCalculateType: 3, _iDataType: 0, _iPower: 0 },
    1111: { _iID: 1111, _iPreAttri: 111, _iCalculateType: 2, _iDataType: 1, _iPower: 0.25 },
    1112: { _iID: 1112, _iPreAttri: 111, _iCalculateType: 4, _iDataType: 1, _iPower: 0.25 },
    1113: { _iID: 1113, _iPreAttri: 111, _iCalculateType: 3, _iDataType: 0, _iPower: 0 },
    1131: { _iID: 1131, _iPreAttri: 113, _iCalculateType: 2, _iDataType: 1, _iPower: 0 },
    1132: { _iID: 1132, _iPreAttri: 113, _iCalculateType: 4, _iDataType: 1, _iPower: 0 },
    1133: { _iID: 1133, _iPreAttri: 113, _iCalculateType: 3, _iDataType: 0, _iPower: 0 },
    1141: { _iID: 1141, _iPreAttri: 115, _iCalculateType: 4, _iDataType: 1, _iPower: 0, name: 'ASPD BuffPerAdd (bp)' },
    1142: { _iID: 1142, _iPreAttri: 115, _iCalculateType: 3, _iDataType: 2, _iPower: 0, name: 'ASPD BuffValAdd (%)' },
  },

  AttributeConversionConfig: {
    1: { _iID: 1, _kAttribute1: [[103, 1], [105, 0.5], [1031, 20]], _kAttribute2: [[105, 0.5]] },
    2: { _iID: 2, _kAttribute1: [[110, 1], [114, 2]], _kAttribute2: [[110, 1], [114, 2]] },
    3: { _iID: 3, _kAttribute1: [[101, 40], [1011, 20], [107, 3], [1071, 1]], _kAttribute2: [[101, 40], [1011, 20], [107, 3], [1071, 1]] },
    4: { _iID: 4, _kAttribute1: [[102, 5], [104, 1], [106, 0.5], [1021, 100], [1041, 20], [108, 0.2], [1081, 10]], _kAttribute2: [[102, 5], [104, 1], [106, 0.5], [1021, 100], [1041, 20], [108, 0.2], [1081, 10]] },
    5: { _iID: 5, _kAttribute1: [[109, 1], [116, 2]], _kAttribute2: [[103, 1], [109, 1], [1031, 20], [116, 2]] },
    6: { _iID: 6, _kAttribute1: [[109, 0.5], [110, 0.5], [111, 20]], _kAttribute2: [[109, 0.5], [110, 0.5], [111, 20]] },
  },

  BasePointConfig: Object.fromEntries(
    Array.from({ length: 100 }, (_, idx) => {
      const v = idx + 1;
      const cost = v === 1 ? 0 : v <= 12 ? 2 : v <= 22 ? 3 : 4;
      return [v, { _iID: v, _iStatusPoint: cost }];
    })
  ),

  BaseLvConfig: Object.fromEntries(
    Array.from({ length: 100 }, (_, idx) => {
      const lv = idx + 1;
      const pts = lv === 1 || lv === 100 ? 0 : lv <= 9 ? 2 : lv === 10 ? 4 : lv === 11 ? 16 : lv <= 16 ? 4 : 8;
      return [lv, { _iID: lv, _iStatusPoint: pts, _iBaseExp: lv === 100 ? 0 : lv * 100 }];
    })
  ),

  EleConfig: {
    1: { _iID: 1, _iNone: 0, _iWind: 0, _iEarth: 0, _iFire: 0, _iWater: 0, _iPoison: 0, _iHoly: 0, _iShadow: 0, _iGhost: -2500, _iUndead: 0 },
    2: { _iID: 2, _iNone: 0, _iWind: -5000, _iEarth: 5000, _iFire: 0, _iWater: -2500, _iPoison: 2500, _iHoly: 0, _iShadow: 0, _iGhost: 0, _iUndead: 0 },
    3: { _iID: 3, _iNone: 0, _iWind: -2500, _iEarth: -5000, _iFire: 5000, _iWater: 0, _iPoison: 2500, _iHoly: 0, _iShadow: 0, _iGhost: 0, _iUndead: 0 },
    4: { _iID: 4, _iNone: 0, _iWind: 0, _iEarth: -2500, _iFire: -5000, _iWater: 5000, _iPoison: 2500, _iHoly: 0, _iShadow: 0, _iGhost: 0, _iUndead: 0 },
    5: { _iID: 5, _iNone: 0, _iWind: 5000, _iEarth: 0, _iFire: -2500, _iWater: -5000, _iPoison: 2500, _iHoly: 0, _iShadow: 0, _iGhost: 0, _iUndead: 0 },
    6: { _iID: 6, _iNone: 0, _iWind: 0, _iEarth: 0, _iFire: 0, _iWater: 0, _iPoison: -5000, _iHoly: 0, _iShadow: -2500, _iGhost: 0, _iUndead: -2500 },
    7: { _iID: 7, _iNone: 0, _iWind: -5000, _iEarth: -5000, _iFire: -5000, _iWater: -5000, _iPoison: -5000, _iHoly: -5000, _iShadow: 5000, _iGhost: -5000, _iUndead: 5000 },
    8: { _iID: 8, _iNone: 0, _iWind: 0, _iEarth: 0, _iFire: 0, _iWater: 0, _iPoison: -2500, _iHoly: 2500, _iShadow: -5000, _iGhost: -2500, _iUndead: -5000 },
    9: { _iID: 9, _iNone: -2500, _iWind: 0, _iEarth: 0, _iFire: 0, _iWater: 0, _iPoison: 0, _iHoly: 0, _iShadow: 0, _iGhost: 2500, _iUndead: 0 },
    10: { _iID: 10, _iNone: 0, _iWind: 0, _iEarth: 0, _iFire: 2500, _iWater: 0, _iPoison: -5000, _iHoly: 5000, _iShadow: -5000, _iGhost: 2500, _iUndead: -5000 },
  },

  JobConfig: {
    1000: { _iID: 1000, name: 'Novice', _iParentId: 0, _iJobRank: 1, _iDistanceType: 1, _kSkillNormalID: [1000001], _kAttri: [[115, 100], [113, 700]] },
    1100: { _iID: 1100, name: 'Swordman', _iParentId: 1000, _iJobRank: 2, _iDistanceType: 1, _kSkillNormalID: [1100001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    1200: { _iID: 1200, name: 'Knight', _iParentId: 1100, _iJobRank: 3, _iDistanceType: 1, _kSkillNormalID: [1100001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    1300: { _iID: 1300, name: 'Lord Knight', _iParentId: 1200, _iJobRank: 4, _iDistanceType: 1, _kSkillNormalID: [1100001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    2100: { _iID: 2100, name: 'Mage', _iParentId: 1000, _iJobRank: 2, _iDistanceType: 1, _kSkillNormalID: [1200001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    2200: { _iID: 2200, name: 'Wizard', _iParentId: 2100, _iJobRank: 3, _iDistanceType: 1, _kSkillNormalID: [1200001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    3100: { _iID: 3100, name: 'Archer', _iParentId: 1000, _iJobRank: 2, _iDistanceType: 2, _kSkillNormalID: [1300001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    3200: { _iID: 3200, name: 'Hunter', _iParentId: 3100, _iJobRank: 3, _iDistanceType: 2, _kSkillNormalID: [1300001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    4100: { _iID: 4100, name: 'Acolyte', _iParentId: 1000, _iJobRank: 2, _iDistanceType: 1, _kSkillNormalID: [1499901], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    4200: { _iID: 4200, name: 'Priest', _iParentId: 4100, _iJobRank: 3, _iDistanceType: 1, _kSkillNormalID: [1499901], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    5100: { _iID: 5100, name: 'Thief', _iParentId: 1000, _iJobRank: 2, _iDistanceType: 1, _kSkillNormalID: [1500001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    5200: { _iID: 5200, name: 'Assassin', _iParentId: 5100, _iJobRank: 3, _iDistanceType: 1, _kSkillNormalID: [1500001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    6100: { _iID: 6100, name: 'Merchant', _iParentId: 1000, _iJobRank: 2, _iDistanceType: 1, _kSkillNormalID: [1600001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
    6200: { _iID: 6200, name: 'Blacksmith', _iParentId: 6100, _iJobRank: 3, _iDistanceType: 1, _kSkillNormalID: [1600001], _kAttri: [[115, 100], [113, 700], [114, 50], [116, 50]] },
  },

  AttriBaseLvConfig: {
    1000001: { _iID: 1000001, _iJob: 1000, _iBaseLv: 1, _kAttri: [[101, 30], [102, 20], [103, 1], [104, 1], [105, 1], [106, 1], [107, 1], [108, 5]] },
    1000050: { _iID: 1000050, _iJob: 1000, _iBaseLv: 50, _kAttri: [[101, 3840], [102, 1000], [103, 96], [104, 96], [105, 80], [106, 80], [107, 202], [108, 100]] },
    1100050: { _iID: 1100050, _iJob: 1100, _iBaseLv: 50, _kAttri: [[101, 4224], [102, 1000], [103, 87], [104, 87], [105, 80], [106, 80], [107, 202], [108, 100]] },
    1200050: { _iID: 1200050, _iJob: 1200, _iBaseLv: 50, _kAttri: [[101, 4224], [102, 1000], [103, 87], [104, 87], [105, 80], [106, 80], [107, 202], [108, 100]] },
    2100050: { _iID: 2100050, _iJob: 2100, _iBaseLv: 50, _kAttri: [[101, 3264], [102, 1000], [103, 111], [104, 111], [105, 80], [106, 80], [107, 202], [108, 100]] },
    2200050: { _iID: 2200050, _iJob: 2200, _iBaseLv: 50, _kAttri: [[101, 3264], [102, 1000], [103, 111], [104, 111], [105, 80], [106, 80], [107, 202], [108, 100]] },
    3100050: { _iID: 3100050, _iJob: 3100, _iBaseLv: 50, _kAttri: [[101, 3264], [102, 1000], [103, 111], [104, 111], [105, 80], [106, 80], [107, 202], [108, 100]] },
    3200050: { _iID: 3200050, _iJob: 3200, _iBaseLv: 50, _kAttri: [[101, 3264], [102, 1000], [103, 111], [104, 111], [105, 80], [106, 80], [107, 202], [108, 100]] },
    4100050: { _iID: 4100050, _iJob: 4100, _iBaseLv: 50, _kAttri: [[101, 4416], [102, 1000], [103, 82], [104, 82], [105, 80], [106, 80], [107, 202], [108, 100]] },
    5100050: { _iID: 5100050, _iJob: 5100, _iBaseLv: 50, _kAttri: [[101, 3264], [102, 1000], [103, 111], [104, 111], [105, 80], [106, 80], [107, 202], [108, 100]] },
    5200050: { _iID: 5200050, _iJob: 5200, _iBaseLv: 50, _kAttri: [[101, 3264], [102, 1000], [103, 111], [104, 111], [105, 80], [106, 80], [107, 202], [108, 100]] },
    1100080: { _iID: 1100080, _iJob: 1100, _iBaseLv: 80, _kAttri: [[101, 8448], [102, 1600], [103, 173], [104, 173], [105, 160], [106, 160], [107, 620], [108, 160]] },
    2100080: { _iID: 2100080, _iJob: 2100, _iBaseLv: 80, _kAttri: [[101, 6528], [102, 1600], [103, 221], [104, 221], [105, 160], [106, 160], [107, 620], [108, 160]] },
    3100080: { _iID: 3100080, _iJob: 3100, _iBaseLv: 80, _kAttri: [[101, 6528], [102, 1600], [103, 221], [104, 221], [105, 160], [106, 160], [107, 620], [108, 160]] },
    5100080: { _iID: 5100080, _iJob: 5100, _iBaseLv: 80, _kAttri: [[101, 6528], [102, 1600], [103, 221], [104, 221], [105, 160], [106, 160], [107, 620], [108, 160]] },
  },

  SkillConfig: {
    // Normal Attacks
    1000001: { _iID: 1000001, name: 'Novice Normal Attack', _iSkillID: 10000, _iLevel: 1, _iMaxLevel: 1, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 0, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 100, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [5000], _kDamageParam2: [10], _kScriptLogic: 'Attack' },
    1100001: { _iID: 1100001, name: 'Swordman Normal Attack', _iSkillID: 11000, _iLevel: 1, _iMaxLevel: 1, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 0, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 100, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [5000], _kDamageParam2: [0], _kScriptLogic: 'AttackSword' },
    1200001: { _iID: 1200001, name: 'Mage Normal Attack', _iSkillID: 12000, _iLevel: 1, _iMaxLevel: 1, _iMode: 0, _iBasicType: 1, _iDmgType: 2, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 0, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 100, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [5000], _kDamageParam2: [0], _kScriptLogic: 'MageAttack' },
    1300001: { _iID: 1300001, name: 'Archer Normal Attack', _iSkillID: 13000, _iLevel: 1, _iMaxLevel: 1, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 0, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 100, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [5000], _kDamageParam2: [0], _kScriptLogic: 'HunterAttack' },
    1500001: { _iID: 1500001, name: 'Thief Normal Attack', _iSkillID: 15000, _iLevel: 1, _iMaxLevel: 1, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 0, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 100, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [5000], _kDamageParam2: [0], _kScriptLogic: 'ThiefAttack' },
    // Swordman / Knight Skills
    1100101: { _iID: 1100101, name: 'Bash Lv1', _iSkillID: 11001, _iLevel: 1, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [4600], _kDamageParam2: [26], _kCost: [[1, 2001, 0, 0]], _kScriptLogic: 'Bash' },
    1100110: { _iID: 1100110, name: 'Bash Lv10', _iSkillID: 11001, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [5500], _kDamageParam2: [35], _kCost: [[1, 2001, 0, 0]], _kScriptLogic: 'Bash' },
    1100210: { _iID: 1100210, name: 'Magnum Break Lv10', _iSkillID: 11002, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 4, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 8000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [6000], _kDamageParam2: [50], _kBuff1: [[1100210, 10000, 8000]], _kCost: [[1, 2001, 0, 12]], _kScriptLogic: 'Magnum_Break' },
    1110410: { _iID: 1110410, name: 'Bowling Bash Lv10', _iSkillID: 11104, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 10000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [18000], _kDamageParam2: [300], _kScriptLogic: 'Bowling_Bash' },
    1110810: { _iID: 1110810, name: 'Brandish Spear Lv10', _iSkillID: 11108, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1000, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [6500], _kDamageParam2: [25], _kScriptLogic: 'Brandish_Spear' },
    1110910: { _iID: 1110910, name: 'Spear Stab Lv10', _iSkillID: 11109, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 10000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [8000], _kDamageParam2: [100], _kScriptLogic: 'Spear_Stab' },
    1120110: { _iID: 1120110, name: 'Aura Blade Lv10', _iSkillID: 11201, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 0, _iEleType: 0, _iDistanceType: 0, _iSkillHit: 10000, _iSkillCri: 0, _iCD: 5000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [], _kDamageParam2: [], _kBuff1: [[1120110, 10000, 120000]], _kCost: [[1, 2001, 0, 20]], _kScriptLogic: 'AuraBlade' },
    1120210: { _iID: 1120210, name: 'Traumatic Blow Lv10', _iSkillID: 11202, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 10000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [20000], _kDamageParam2: [300], _kScriptLogic: 'TraumaticBlow' },
    // Mage / Wizard Skills
    1200401: { _iID: 1200401, name: 'Fire Bolt Lv1', _iSkillID: 12004, _iLevel: 1, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 2, _iEleType: 4, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 500, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 1000, _kDamageParam1: [5500], _kDamageParam2: [91], _kScriptLogic: 'Fire_Bolt' },
    1200410: { _iID: 1200410, name: 'Fire Bolt Lv10', _iSkillID: 12004, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 2, _iEleType: 4, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 500, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 1000, _kDamageParam1: [10000], _kDamageParam2: [100], _kScriptLogic: 'Fire_Bolt' },
    1201010: { _iID: 1201010, name: 'Fire Wall Lv10', _iSkillID: 12010, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 2, _iEleType: 4, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 10000, _iActionTime: 420, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 840, _kDamageParam1: [4000], _kDamageParam2: [20], _kLogicData: [1200004, 200, 5000], _kScriptLogic: 'Fire_Wall' },
    1201210: { _iID: 1201210, name: 'Fire Ball Lv10', _iSkillID: 12012, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 2, _iEleType: 4, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 5000, _iActionTime: 300, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 600, _kDamageParam1: [15000], _kDamageParam2: [200], _kScriptLogic: 'FireBall' },
    1210210: { _iID: 1210210, name: 'Jupitel Thunder Lv10', _iSkillID: 12102, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 2, _iEleType: 2, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 10000, _iActionTime: 420, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 840, _kDamageParam1: [15000], _kDamageParam2: [100], _kScriptLogic: 'Jupitel_Thunder' },
    1210810: { _iID: 1210810, name: 'Storm Gust Lv10', _iSkillID: 12108, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 2, _iEleType: 5, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 8000, _iActionTime: 420, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 840, _kDamageParam1: [1000], _kDamageParam2: [130], _kLogicData: [1200008, 500, 4500], _kScriptLogic: 'Storm_Gust' },
    1220910: { _iID: 1220910, name: 'Wizard Passive Lv10', _iSkillID: 12209, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 0, _kAttri: [[1021, 1000], [104, 10]] },
    // Archer / Hunter Skills
    1300110: { _iID: 1300110, name: 'Owl Eye Lv10', _iSkillID: 13001, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 0, _kAttri: [[103, 10], [5, 5]] },
    1300210: { _iID: 1300210, name: 'Vulture Eye Lv10', _iSkillID: 13002, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 0, _kAttri: [[103, 10], [2, 5], [114, 10]] },
    1300310: { _iID: 1300310, name: 'Double Strafe Lv10', _iSkillID: 13003, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 0, _iActionTime: 800, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [10000], _kDamageParam2: [75], _kScriptLogic: 'DoubleStrafe' },
    1300410: { _iID: 1300410, name: 'Arrow Shower Lv10', _iSkillID: 13004, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 5000, _iActionTime: 870, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [6500], _kDamageParam2: [85], _kScriptLogic: 'ArrowShower' },
    1300610: { _iID: 1300610, name: 'Attention Concentrate Lv10', _iSkillID: 13006, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 0, _iEleType: 0, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 0, _iCD: 10000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [], _kDamageParam2: [], _kBuff1: [[1300210, 10000, 120000]], _kScriptLogic: 'XinShenNingJu' },
    1320210: { _iID: 1320210, name: 'Falcon Assault Lv10', _iSkillID: 13202, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 10000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [14000], _kDamageParam2: [160], _kScriptLogic: 'FalconAssault' },
    1320410: { _iID: 1320410, name: 'Focused Arrow Strike Lv10', _iSkillID: 13204, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1500, _iActionTimeInfluence: 100, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [5500], _kDamageParam2: [55], _kScriptLogic: 'RuiLiSheJi' },
    // Thief / Assassin Skills
    1500110: { _iID: 1500110, name: 'Improve Dodge Lv10', _iSkillID: 15001, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 0, _kAttri: [[110, 20], [1131, 500], [1033, 10]] },
    1500510: { _iID: 1500510, name: 'Envenom Lv10', _iSkillID: 15005, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 6, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 5000, _iActionTime: 1000, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [8000], _kDamageParam2: [110], _kScriptLogic: 'Envenom' },
    1510210: { _iID: 1510210, name: 'Sonic Blow Lv10', _iSkillID: 15102, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 0, _iActionTime: 1200, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [8500], _kDamageParam2: [50], _kScriptLogic: 'SonicBlow' },
    1510910: { _iID: 1510910, name: 'Grimtooth Lv10', _iSkillID: 15109, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 8000, _iActionTime: 500, _iActionTimeInfluence: 0, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [10000], _kDamageParam2: [150], _kScriptLogic: 'Grimtooth' },
    1522210: { _iID: 1522210, name: 'Cross Impact Lv10', _iSkillID: 15222, _iLevel: 10, _iMaxLevel: 10, _iMode: 0, _iBasicType: 1, _iDmgType: 1, _iEleType: 1, _iDistanceType: 1, _iSkillHit: 10000, _iSkillCri: 10000, _iCD: 0, _iActionTime: 500, _iActionTimeInfluence: 100, _iChantFix: 0, _iChantVar: 0, _kDamageParam1: [20000], _kDamageParam2: [56], _kScriptLogic: 'shizizhan' },
  },

  BuffConfig: {
    1100301: { _iID: 1100301, _iBuffID: 11003, _iTime: 10000, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [], _kSkillAttributeList: [[0, 11001, 29, 5, 500]] },
    1100210: { _iID: 1100210, _iBuffID: 11002, _iTime: 8000, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [[304, 500]], _kSkillAttributeList: [] },
    1120110: { _iID: 1120110, _iBuffID: 11201, _iTime: 120000, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [], _kSkillAttributeList: [[0, 11000, 29, 5, 1500]] },
    1246101: { _iID: 1246101, _iBuffID: 12461, _iTime: 10000, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [], _kSkillAttributeList: [[0, 12201, 29, 1, 500, -1], [0, 12201, 30, 1, 10, -1]] },
    1300210: { _iID: 1300210, _iBuffID: 13002, _iTime: 120000, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [[2, 6], [5, 11]], _kSkillAttributeList: [] },
    1400110: { _iID: 1400110, _iBuffID: 14001, _iTime: 120000, _iStackType: 5, _iMaxStack: 1, _kChangeAttri: [[1, 10], [5, 10], [4, 10]], _kSkillAttributeList: [] },
    1401010: { _iID: 1401010, _iBuffID: 14010, _iTime: 120000, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [[2, 5], [1131, 500], [1141, 1000]], _kSkillAttributeList: [] },
    1410610: { _iID: 1410610, _iBuffID: 14106, _iTime: 120000, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [[6, 10]], _kSkillAttributeList: [] },
    1610610: { _iID: 1610610, _iBuffID: 16106, _iTime: 600000, _iStackType: 5, _iMaxStack: 1, _kChangeAttri: [[1033, 10]], _kSkillAttributeList: [] },
    2500101: { _iID: 2500101, _iBuffID: 25001, _iTime: 0, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4013, 4017], _kLogicData: [5000] },
    2500201: { _iID: 2500201, _iBuffID: 25002, _iTime: 0, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4012, 4017], _kLogicData: [5000] },
    2500301: { _iID: 2500301, _iBuffID: 25003, _iTime: 0, _iStackType: 7, _iMaxStack: 2, _kChangeAttri: [[1032, 200]], _kBuffCategory: [4001, 4003, 4006, 4007, 23] },
    2500401: { _iID: 2500401, _iBuffID: 25004, _iTime: 0, _iStackType: 7, _iMaxStack: 2, _kChangeAttri: [[1042, 200]], _kBuffCategory: [4001, 4002, 4006, 4007, 23] },
    2500501: { _iID: 2500501, _iBuffID: 25005, _iTime: 0, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4013, 4017], _kLogicData: [5000] },
    2500601: { _iID: 2500601, _iBuffID: 25006, _iTime: 0, _iStackType: 4, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4012, 4017], _kLogicData: [5000] },
    2500701: { _iID: 2500701, _iBuffID: 25007, _iTime: 0, _iStackType: 7, _iMaxStack: 2, _kChangeAttri: [[211, 200]], _kBuffCategory: [4001, 4003, 4006, 4007, 23] },
    2500801: { _iID: 2500801, _iBuffID: 25008, _iTime: 0, _iStackType: 7, _iMaxStack: 2, _kChangeAttri: [[213, 200]], _kBuffCategory: [4001, 4002, 4006, 4007, 23] },
    2503001: { _iID: 2503001, _iBuffID: 25030, _iTime: 0, _iStackType: 0, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4012], _kLogicData: [30, 213, 700] },
    2514301: { _iID: 2514301, _iBuffID: 25143, _iTime: 0, _iStackType: 0, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4013], _kLogicData: [30, 211, 700] },
    2504001: { _iID: 2504001, _iBuffID: 25040, _iTime: 0, _iStackType: 0, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4012], _kLogicData: [1500, 2504001], _kDescData: [15, 110, 5] },
    2515701: { _iID: 2515701, _iBuffID: 25157, _iTime: 0, _iStackType: 0, _iMaxStack: 1, _kChangeAttri: [], _kBuffCategory: [4010, 4013], _kLogicData: [1500, 2515701], _kDescData: [15, 110, 5] },
  },

  SpecialEffectConfig: {
    1: { _iID: 1, _iGroupID: 1, _kSpecialEffect: [[1, 1, 10]], _iPower: 100 },
    10010401: { _iID: 10010401, _iGroupID: 0, _kSpecialEffect: [[5, 1, 103, 2]], _iPower: 220 },
    10010404: { _iID: 10010404, _iGroupID: 0, _kSpecialEffect: [[4, 1, 10, 103, 3]], _iPower: 350 },
    10010505: { _iID: 10010505, _iGroupID: 0, _kSpecialEffect: [[5, 1, 209, 25]], _iPower: 350 },
    10020402: { _iID: 10020402, _iGroupID: 0, _kSpecialEffect: [[8, 104, 100, 1033, 1, 160]], _iPower: 350 },
    10020404: { _iID: 10020404, _iGroupID: 0, _kSpecialEffect: [[14, 103, 104, 10, 1013, 4, 4000]], _iPower: 350 },
    12400001: { _iID: 12400001, _iGroupID: 0, _kSpecialEffect: [[2, 2500201]], _iPower: 0 },
    12300007: { _iID: 12300007, _iGroupID: 0, _kSpecialEffect: [[10, 2, 1, 8000, 1043, 2, 20000]], _iPower: 0 },
    12400012: { _iID: 12400012, _iGroupID: 0, _kSpecialEffect: [[18, 4002, 1]], _iPower: 0 },
    12400011: { _iID: 12400011, _iGroupID: 0, _kSpecialEffect: [[1, 213, 100], [12, 1, 4002, 2, 1, 50, 5, 1]], _iPower: 0 },
    12400018: { _iID: 12400018, _iGroupID: 0, _kSpecialEffect: [[1, 216, 100], [12, 1, 4005, 2, 1, 50, 5, 1]], _iPower: 0 },
    12400021: { _iID: 12400021, _iGroupID: 0, _kSpecialEffect: [[1, 207, 100], [12, 1, 4004, 2, 1, 50, 5, 1]], _iPower: 0 },
    12400015: { _iID: 12400015, _iGroupID: 0, _kSpecialEffect: [[1, 229, 100], [12, 1, 4003, 2, 1, 50, 6, 1]], _iPower: 0 },
  },

  TotemSkillConfig: {
    10051001: { _iID: 10051001, _kBasicAttribute: [], _kSpecialAttribute: [12400001], _iSuperiorSkillID: 0, _iIsCoexist: 1, _iPower: 1500 },
    10052017: { _iID: 10052017, _kBasicAttribute: [], _kSpecialAttribute: [12300007], _iSuperiorSkillID: 10053017, _iIsCoexist: 0, _iPower: 1000 },
    10053001: { _iID: 10053001, _kBasicAttribute: [], _kSpecialAttribute: [12400012], _iSuperiorSkillID: 0, _iIsCoexist: 0, _iPower: 1250 },
    10053005: { _iID: 10053005, _kBasicAttribute: [], _kSpecialAttribute: [12400011], _iSuperiorSkillID: 0, _iIsCoexist: 0, _iPower: 1250 },
    10053010: { _iID: 10053010, _kBasicAttribute: [], _kSpecialAttribute: [12400018], _iSuperiorSkillID: 0, _iIsCoexist: 0, _iPower: 1250 },
    10053012: { _iID: 10053012, _kBasicAttribute: [], _kSpecialAttribute: [12400021], _iSuperiorSkillID: 0, _iIsCoexist: 0, _iPower: 1250 },
  },

  Monsters: {
    poring: { npcId: 5000001, name: 'Poring', level: 5, maxHp: 65, atk: 9, matk: 9, def: 100, mdef: 100, hit: 6, flee: 5, resCri: 0, element: 5, race: 4, size: 2 },
    chonchon: { npcId: 5000005, name: 'Chonchon', level: 21, maxHp: 447, atk: 140, matk: 140, def: 420, mdef: 420, hit: 22, flee: 21, resCri: 0, element: 2, race: 9, size: 1 },
    maya: { npcId: 5300006, name: 'Maya (Story L30)', level: 30, maxHp: 31458, atk: 143, matk: 143, def: 600, mdef: 600, hit: 31, flee: 30, resCri: 0, element: 4, race: 1, size: 3 },
    baphomet: { npcId: 5300003, name: 'Baphomet (Story L40)', level: 40, maxHp: 41258, atk: 236, matk: 236, def: 800, mdef: 800, hit: 41, flee: 40, resCri: 0, element: 4, race: 1, size: 3 },
    pharaoh: { npcId: 5300010, name: 'Pharaoh (Story L45)', level: 45, maxHp: 45536, atk: 260, matk: 260, def: 900, mdef: 900, hit: 46, flee: 45, resCri: 0, element: 3, race: 1, size: 2 },
    orc_hero: { npcId: 5020004, name: 'Orc Hero (MVP L48)', level: 48, maxHp: 23686236, atk: 3418, matk: 3418, def: 960, mdef: 960, hit: 49, flee: 48, resCri: 0, element: 3, race: 2, size: 3 },
    eddga: { npcId: 5020009, name: 'Eddga (MVP L59)', level: 59, maxHp: 90482296, atk: 11751, matk: 11751, def: 1180, mdef: 1180, hit: 60, flee: 59, resCri: 0, element: 4, race: 1, size: 3 },
    baphomet_mvp: { npcId: 5020013, name: 'Baphomet (MVP L83)', level: 83, maxHp: 210948480, atk: 31627, matk: 31627, def: 1660, mdef: 1660, hit: 84, flee: 83, resCri: 0, element: 8, race: 3, size: 3 },
  },
};

const GLOBAL_TABLE_CACHE = new Map();

export class Ro3DataStore {
  constructor(configDir = DEFAULT_CONFIG_DIR) {
    this.configDir = configDir;
    this.usingExportedJson = Boolean(configDir && fs.existsSync(configDir));
  }

  table(name) {
    const cacheKey = `${this.usingExportedJson ? this.configDir : 'fallback'}::${name}`;
    if (GLOBAL_TABLE_CACHE.has(cacheKey)) return GLOBAL_TABLE_CACHE.get(cacheKey);
    let loaded = FALLBACK_TABLES[name] ? structuredClone(FALLBACK_TABLES[name]) : {};
    // SkillTiming is not part of the server's config export: it comes from the template digest next to this file.
    const file = name === 'SkillTiming' ? DEFAULT_TIMING_FILE : this.usingExportedJson ? path.join(this.configDir, `${name}.json`) : '';
    if (file && fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed)) {
        for (let idx = 0; idx < parsed.length; idx++) {
          const r = parsed[idx];
          const k = r && r._iID != null ? String(r._iID) : String(idx + 1);
          loaded[k] = { ...loaded[k], ...r };
        }
      } else if (parsed && typeof parsed === 'object') {
        for (const [k, r] of Object.entries(parsed)) {
          loaded[k] = loaded[k] ? { ...loaded[k], ...r } : r;
        }
      }
    }
    GLOBAL_TABLE_CACHE.set(cacheKey, loaded);
    return loaded;
  }

  row(tableName, id) {
    const tbl = this.table(tableName);
    return tbl[String(id)] ?? tbl[Number(id)] ?? null;
  }
}

/** Same fallback + overlay merge as Ro3DataStore, but over in-memory `{ TableName: { id: row } }` (browser build). */
export class Ro3MemoryDataStore extends Ro3DataStore {
  constructor(tables) {
    super(null);
    this.tables = tables;
    this.usingExportedJson = true;
    this.cache = new Map();
  }

  table(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const loaded = FALLBACK_TABLES[name] ? structuredClone(FALLBACK_TABLES[name]) : {};
    for (const [k, r] of Object.entries(this.tables[name] ?? {})) loaded[k] = loaded[k] ? { ...loaded[k], ...r } : r;
    this.cache.set(name, loaded);
    return loaded;
  }
}

// ============================================================================
// 2. Stat Point Costs & Character Attribute Pipeline (`StatCalculator.cs`)
// ============================================================================

export const STARTING_STAT_POINTS = 48;
export const MAX_STAT = 99;

export function totalStatPoints(level, bonusPoints = 0, data = new Ro3DataStore()) {
  let sum = STARTING_STAT_POINTS + bonusPoints;
  for (let lv = 2; lv <= level; lv++) {
    const row = data.row('BaseLvConfig', lv);
    sum += row ? Number(row._iStatusPoint || 0) : 0;
  }
  return sum;
}

export function statCost(value, data = new Ro3DataStore()) {
  const v = Math.max(1, Math.min(MAX_STAT, Math.trunc(value)));
  let sum = 0;
  for (let k = 2; k <= v; k++) {
    const row = data.row('BasePointConfig', k);
    sum += row ? Number(row._iStatusPoint || 0) : (k <= 12 ? 2 : k <= 22 ? 3 : 4);
  }
  return sum;
}

export function usedStatPoints(stats6, data = new Ro3DataStore()) {
  return stats6.reduce((acc, v) => acc + statCost(v, data), 0);
}

/**
 * Exact implementation of `StatCalculator.Compute(raw, data)` from `StatCalculator.cs`.
 * final = B1 * (1 + B2 + B6) * (1 + B4) + B3
 * Integer roots (dt == 0) use Math.ceil(final - 1e-6); scaled roots (dt == 1 or 2) use Math.round(unscale(final)).
 */
export function computeStatSheet(raw, data = new Ro3DataStore()) {
  const sheet = { data: {}, base: {} };
  const groups = new Map();

  const dataType = (id) => {
    const row = data.row('AttributeConfig', id);
    return row ? Number(row._iDataType || 0) : 0;
  };
  const scale = (dt, v) => (dt === 1 ? v / 10000 : dt === 2 ? v / 100 : v);
  const unscale = (dt, v) => (dt === 1 ? v * 10000 : dt === 2 ? v * 100 : v);

  for (const [key, val] of Object.entries(raw)) {
    const id = Number(key);
    const value = Number(val || 0);
    const row = data.row('AttributeConfig', id);
    const root = row ? Number(row._iPreAttri || 0) : 0;
    if (!row || root === 0) {
      sheet.data[id] = Math.round(value);
      sheet.base[id] = Math.floor(value);
      continue;
    }
    let calc = Number(row._iCalculateType || 1);
    if (calc < 1 || calc > 6 || calc === 5) calc = 1;
    let b = groups.get(root);
    if (!b) {
      b = [0, 0, 0, 0, 0, 0, 0];
      groups.set(root, b);
    }
    b[calc] += scale(dataType(id), value);
    if (id !== root) {
      sheet.data[id] = Math.floor(value);
      sheet.base[id] = Math.floor(value);
    }
  }

  for (const [root, b] of groups.entries()) {
    const finalVal = b[1] * (1 + b[2] + b[6]) * (1 + b[4]) + b[3];
    const dt = dataType(root);
    sheet.data[root] = dt === 0 ? Math.ceil(finalVal - 1e-6) : Math.round(unscale(dt, finalVal));
    sheet.base[root] = Math.floor(Number(raw[root] || 0));
  }

  return new Proxy(sheet, {
    get(target, prop) {
      if (prop in target) return target[prop];
      const num = Number(prop);
      if (!Number.isNaN(num)) return target.data[num] ?? 0;
      return undefined;
    },
  });
}

/**
 * Equipment Resonance (`CharacterService.Equipment.cs` ResonanceRow): the highest row of RefiningEffectTable / StrengthenEffectTable
 * whose `_kRequest` [grids, level] holds, i.e. at least `grids` of the 7 equipment grids are at `level` or more, adds its `_kEffect`.
 * `refine` / `enhance` are the level every grid has reached. Returns the rows reached and their attributes.
 */
export function resonanceEffects(refine = 0, enhance = 0, data = new Ro3DataStore()) {
  const tier = (table, level) => Object.values(data.table(table)).filter((r) => Number(r._kRequest?.[1]) <= level).sort((a, b) => b._iEffectLev - a._iEffectLev)[0] ?? null;
  const rows = { refine: tier('RefiningEffectTable', refine), enhance: tier('StrengthenEffectTable', enhance) };
  return { ...rows, attrs: [...asPairs(rows.refine?._kEffect), ...asPairs(rows.enhance?._kEffect)] };
}

/**
 * Cards. `build.cards` lists the cards in the sockets: [{ id, star, level, flash }], `id` the card's item id, `star` 0-3 its advancement
 * (the CardConfig tier) and `level` 0..the star's cap (5 / 10 / 15 / 15; a missing star or level means the maximum). A card gives the
 * basic attributes of its star plus the attributes of its level (CardUpgradeConfig by slot part and quality: P.ATK + M.ATK for weapon,
 * off-hand, accessory and mouth cards, HP for the others), like `CharacterService.EntityData`. A unique card (`_iIfSameCard`: the MVP
 * and shadow cards) counts once however often it is slotted. `flash` marks the Collection version of a purple, gold or red card (made by
 * Collection synthesis: "ornate card art and slightly enhanced effects"): it adds the card's `_kFlashAttribute` ("Collection
 * attributes" on the wiki: Crit DMG, Damage Increase and Bonus ATK for weapon and accessory cards, the defensive twins for the rest).
 * The server ignores the special effects (`_kSkillAttribute`) and the Collection attributes; these effects are modeled here:
 *   op 8  "Every 1 HIT increases Physical damage by 0.01%, up to 8.5%" (Phreeoni): the HIT conversion an equipment stunt has
 *   op 2  Drake's flat or Shadow Drake's chance-based damage against all sizes, applied in combat, not added to the panel's size stats
 * Both Drake variants make all offensive size bonuses eligible. Shadow's text separates size-ignore from its chance-based extra damage.
 * Proc effects (stun, curse, autocast skills), revive, reflect, "damage against all Orcs" and the like are not simulated.
 * `cardParts` splits one card into what the wiki lists separately (basic attributes of the star, the level bonus, the effect ids, the
 * Collection attributes); `cardEffects` adds their panel attributes, conversions and separate combat size modifiers.
 */
export const CARD_BUFFS = { 20500: [501, 503, 505], 20501: [501, 503, 505] };
// A table's rows by key (one key per table), built once: tableIndex = the row of a key, tableGroups = every row of a key, in table order.
const TABLE_INDEX = new WeakMap();
const tableIndex = (data, table, key) => {
  const rows = data.table(table);
  if (!TABLE_INDEX.has(rows)) TABLE_INDEX.set(rows, new Map(Object.values(rows).map((r) => [key(r), r])));
  return TABLE_INDEX.get(rows);
};
const TABLE_GROUPS = new WeakMap();
const tableGroups = (data, table, key) => {
  const rows = data.table(table);
  if (!TABLE_GROUPS.has(rows)) {
    const groups = new Map();
    for (const r of Object.values(rows)) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
    TABLE_GROUPS.set(rows, groups);
  }
  return TABLE_GROUPS.get(rows);
};
export const cardTier = (data, id, star) => tableIndex(data, 'CardConfig', (r) => `${r._iCardID}:${r._iTier}`).get(`${id}:${star}`);
// Panel attributes, conversions and combat size modifiers of a card's special effects (`_kSkillAttribute` ids).
function cardEffectParts(effectIds, data) {
  const out = { attrs: [], stunts: [], sizeBonusBp: 0, sizeProc: null, ignoreSize: false };
  for (const fx of effectIds) {
    for (const op of asArray(data.row('SpecialEffectConfig', fx)?._kSpecialEffect)) {
      const family = Math.floor(op[1] / 100);
      if (op[0] === 8) out.stunts.push({ _kSpecialEffect: [op] });
      else if (op[0] === 2 && CARD_BUFFS[family]) {
        const logic = asArray(data.row('BuffConfig', op[1])?._kLogicData);
        const proc = family === 20500;
        if (logic.length !== (proc ? 2 : 1) || !logic.every((v) => Number.isFinite(v) && v >= 0) || (proc && logic[0] > 10000)) {
          throw new Error(`Invalid Drake buff parameters: ${op[1]}`);
        }
        out.ignoreSize = true;
        if (proc) out.sizeProc = { chanceBp: logic[0], bonusBp: logic[1] };
        else out.sizeBonusBp += logic[0];
      }
    }
  }
  return out;
}
export function cardParts(c, data = new Ro3DataStore()) {
  const item = c?.id ? data.row('ItemConfig', c.id) : null;
  const star = Math.max(0, Math.min(3, Math.trunc(c?.star ?? 3) || 0));
  const tier = item && cardTier(data, item._iID, star);
  if (!tier) return null;
  const level = Math.max(0, Math.min(tier._iLevel || 15, Math.trunc(c.level ?? 15) || 0));
  const upgrade = tableIndex(data, 'CardUpgradeConfig', (r) => `${r._iParts}:${r._iQuality}:${r._iLevel}`).get(`${item._iCardPart}:${item._iQuality}:${level}`);
  const collectionAttrs = asArray(tier._kFlashAttribute).flatMap((fx) => asArray(data.row('SpecialEffectConfig', fx)?._kSpecialEffect)
    .filter((op) => op.length === 3 && op[0] === 1).map(([, a, v]) => [a, v]));
  const effects = asArray(tier._kSkillAttribute);
  return { item, star, level, base: asPairs(tier._kBasicAttribute), levelAttrs: asPairs(upgrade?._iAttr), effects, modeled: cardEffectParts(effects, data), collectionAttrs };
}
export function cardEffects(cards, data = new Ro3DataStore()) {
  const out = { attrs: [], stunts: [], sizeBonusBp: 0, sizeProc: null, ignoreSize: false };
  const seen = new Set();
  for (const c of asArray(cards)) {
    const p = cardParts(c, data);
    if (!p || (p.item._iIfSameCard && seen.has(p.item._iID))) continue;
    seen.add(p.item._iID);
    out.attrs.push(...p.base, ...p.levelAttrs, ...(c.flash ? p.collectionAttrs : []), ...p.modeled.attrs);
    out.stunts.push(...p.modeled.stunts);
    out.sizeBonusBp += p.modeled.sizeBonusBp;
    out.ignoreSize ||= p.modeled.ignoreSize;
    // ponytail: only unique Shadow Drake has this proc; use independent proc states if another proc card is added.
    out.sizeProc = p.modeled.sizeProc ?? out.sizeProc;
  }
  return out;
}
/**
 * What the sheet adds against this target (`defender.element / race / size`), in basis points: "Damage to <element> Monsters" (321-330),
 * "Damage to <race> Race" (401-410) and "DMG vs Small / Medium / Large Enemies" (501 / 503 / 505). Without the target's element, race or
 * size that part is 0 (321 + 0 would be a different attribute). Either Drake enables all three offensive size attributes; its own flat or
 * chance-based combat bonus is separate from the panel's size attributes. Race and element conditions are unchanged.
 */
export function targetBonus(stats, defender, sizeBonusBp = 0, ignoreSize = false) {
  const [e, r, s] = [Number(defender.element), Number(defender.race), Number(defender.size)];
  return (Number.isInteger(e) && e >= 1 && e <= 10 ? stats[320 + e] : 0)
    + (Number.isInteger(r) && r >= 1 && r <= 10 ? stats[400 + r] : 0)
    + (Number.isInteger(s) && s >= 1 && s <= 3 ? (ignoreSize ? stats[501] + stats[503] + stats[505] : stats[499 + 2 * s]) + sizeBonusBp : 0);
}

// An entry's value at a roll position (0-10000): uniform whole numbers from min to max, like the server's draw.
export const affixValue = (min, max, ratio) => min + Math.min(max - min, Math.floor((ratio * (max - min + 1)) / 10000));
/**
 * Gear: tier 5-7 equipment. `build.gear` lists the worn items, one per equipment grid (1 weapon, 2 off-hand, 3 armor, 4 cloak, 5 shoes,
 * 6 and 7 accessories): [{ grid, id, roll, affixes, stunts, refine, enhance }].
 *   id       the item (ItemConfig; its `_iEquipId` joins EquipConfig, `_iRank` is the tier)
 *   roll     0-10000, where in its range the item rolled: the server draws one ratio per base attribute (EquipAttriRandom, by quality) and
 *            gives min + (max - min) * ratio / 10000; the random entries roll uniformly in their range, at the same position here
 *   affixes  the attributes of the random entries (STR..LUK of the item's EquipAttriGroupConfig pool): as many as EquipEntryRandom gives
 *            the quality (Purple 1, Gold up to 2, Red 2; Blue none), none twice
 *   stunts   one SpecialEffectConfig id per stunt pool of the item (`_kSpecial`: a common pool and a rare one); fixed stunts come with it
 *   refine / enhance  the levels of the grid (RefiningTable / StrengthenTable hold the totals at a level, counted for a worn grid)
 *   offRefine / offEnhance  on a two-handed weapon: the levels of the off-hand grid. The client lists such a weapon in both weapon grids and lets you
 *            strengthen and refine either (Equipment resonance needs all 7 grids), so its levels count too: Max HP only, as the off-hand rows hold nothing else
 * Stunts take the stunts path of buildCharacterStats: per refine of their grid (op 5), per stunt on the gear (op 4, all grids together)
 * and the conversions (ops 8 and 14). Effects that give no stat (revive, evade, potion boost) count as stunts but add nothing; the
 * `[1, 103, 1]` rows that stand in for them must not become +1 P.ATK. A weapon listed here replaces `weaponRefine` / `weaponStrengthen`.
 * `gearParts` is one item broken down the way the Gear window shows it, `gearEffects` the whole set as { attrs, stunts, count, grids }.
 */
export function gearParts(g, data = new Ro3DataStore()) {
  const item = g?.id ? data.row('ItemConfig', g.id) : null;
  const eq = item?._iEquipId ? data.row('EquipConfig', item._iEquipId) : null;
  if (!eq) return null;
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v)) || 0));
  const [grid, ratio, refine, enhance] = [int(g.grid, 0, 99), int(g.roll ?? 5000, 0, 10000), int(g.refine, 0, 99), int(g.enhance, 0, 999)];
  const base = asPairs(eq._kBasicAttribute).map(([attr, min, max = min]) => ({ attr, min, max, value: min + Math.trunc(((max - min) * ratio) / 10000) }));
  const entries = Number(eq._iEntries);
  const pool = entries > 0 ? (tableGroups(data, 'EquipAttriGroupConfig', (r) => r._iGroup).get(entries) ?? []).filter((r) => r._iWeight > 0 && r._iAttriID > 0 && r._iMax >= r._iMin) : [];
  const slots = pool.length ? Math.max(0, ...Object.values(data.table('EquipEntryRandom')).filter((r) => r._iQuality === item._iQuality && r._iWeight > 0).map((r) => r._iNum)) : 0;
  const affixes = [];
  for (const attr of asArray(g.affixes)) {
    const row = pool.find((r) => r._iAttriID === attr);
    if (!row || affixes.length >= slots || affixes.some((a) => a.attr === attr)) continue;
    affixes.push({ attr, min: row._iMin, max: row._iMax, value: affixValue(row._iMin, row._iMax, ratio) });
  }
  const directives = asArray(eq._kSpecial).filter(Array.isArray);
  const pools = directives.map(([group]) => (tableGroups(data, 'EquipSpecialGroupConfig', (r) => r._iGroup).get(group) ?? []).filter((r) => r._iWeight > 0).map((r) => r._iSpecialID));
  // A pool of one that always rolls (chance 10000) is a stunt the item always has
  const stunts = pools.map((p, i) => (p.length === 1 && directives[i][1] >= 10000 ? p[0] : p.includes(asArray(g.stunts)[i]) ? g.stunts[i] : 0));
  const refined = tableIndex(data, 'RefiningTable', (r) => `${r._iEquipType}:${r._iRefiningInterval}`).get(`${grid}:${refine}`);
  const enhanced = tableIndex(data, 'StrengthenTable', (r) => `${r._iEquipType}:${r._iStrengthenInterval}`).get(`${grid}:${enhance}`);
  return {
    item, eq, grid, ratio, rank: eq._iRank, base, fixed: asPairs(eq._kFixedEntries), pool, slots, affixes, pools, chances: directives.map((d) => d[1]), stunts,
    fixedStunts: asArray(eq._kFixedSpecialAttribute), refine, enhance, refineAttrs: asPairs(refined?._kAttr), enhanceAttrs: asPairs(enhanced?._kAttr),
  };
}
// The ops of a gear stunt the sheet can use (see above).
const gearStuntOps = (id, data) => asArray(data.row('SpecialEffectConfig', id)?._kSpecialEffect)
  .filter((op) => (op[0] === 1 ? op.length === 3 && !(op[1] === 103 && op[2] === 1) : [4, 5, 8, 14].includes(op[0])));
export function gearEffects(gear, data = new Ro3DataStore()) {
  const out = { attrs: [], stunts: [], count: 0, grids: new Set() };
  let twoHanded = null;
  for (const g of asArray(gear)) {
    const p = gearParts(g, data);
    if (!p || p.grid < 1 || p.grid > 7 || out.grids.has(p.grid)) continue;
    out.grids.add(p.grid);
    if (p.grid === 1 && p.item._iEquipPart === 1) twoHanded = g;
    out.attrs.push(...p.base.map((b) => [b.attr, b.value]), ...p.fixed, ...p.affixes.map((a) => [a.attr, a.value]), ...p.enhanceAttrs, ...p.refineAttrs);
    for (const id of [...p.fixedStunts, ...p.stunts].filter(Boolean)) {
      out.count++;
      const ops = gearStuntOps(id, data);
      if (ops.length) out.stunts.push({ _kSpecialEffect: ops, refine: p.refine });
    }
  }
  if (twoHanded && !out.grids.has(2)) out.attrs.push(...offHandLevelAttrs(twoHanded.offRefine, twoHanded.offEnhance, data));
  return out;
}
/** The off-hand grid's levels as attributes (StrengthenTable / RefiningTable rows of grid 2): Max HP only. See `offRefine` / `offEnhance` of `gearParts`. */
export function offHandLevelAttrs(refine, enhance, data = new Ro3DataStore()) {
  const at = (table, key, level) => asPairs(tableIndex(data, table, (r) => `${r._iEquipType}:${r[key]}`).get(`2:${Math.max(0, Math.round(Number(level)) || 0)}`)?._kAttr);
  return [...at('StrengthenTable', '_iStrengthenInterval', enhance), ...at('RefiningTable', '_iRefiningInterval', refine)];
}
/** The roll position (0-10000) at or below which a share `p` of the rolls of this quality fall (EquipAttriRandom weights): the Gear window's Low / Mid / High. */
export function rollQuantile(quality, p, data = new Ro3DataStore()) {
  const rows = Object.values(data.table('EquipAttriRandom')).filter((r) => r._iQuality === quality && r._iWeight > 0).sort((a, b) => a._iRatio - b._iRatio);
  const total = rows.reduce((s, r) => s + r._iWeight, 0);
  let sum = 0;
  for (const r of rows) if ((sum += r._iWeight) / total >= p - 1e-9) return r._iRatio;
  return rows.at(-1)?._iRatio ?? 5000;
}

// The weapon Refine +n of `build.weaponRefine` (flat P.ATK and M.ATK); the gear's grids use the RefiningTable instead.
const WEAPON_REFINE_BONUS = [0, 20, 41, 62, 85, 108, 132, 157, 184, 211, 240, 270, 301, 333, 366, 400];
/** The flat P.ATK and M.ATK that `weaponRefine` + `weaponStrengthen` add: what a saved simulator state that kept them as fields stood for. */
export const legacyWeaponFlat = (refine, strengthen) => strengthen * 2 + (WEAPON_REFINE_BONUS[refine] ?? refine * 24);

/**
 * The ASPD cap and what lies above it: "Every 1 excess ASPD is converted to 0.1% Physical ATK (Max: 20%)" past 500% (the tip of AttributeConfig 115, which
 * `node build-ro3-sim.mjs` checks). Basis points of P.ATK % (attribute 1031) per point of excess, and their cap.
 */
export const ASPD_EXCESS = { cap: 500, bpPerPoint: 10, maxBp: 2000 };

/**
 * Computes full character StatSheet matching `CharacterService.Stats(session)` + `EquipmentStunts.ApplyConversions`.
 */
export function buildCharacterStats(build, data = new Ro3DataStore(), skipTotemOp10 = false) {
  const career = build.career ?? 1100;
  const level = build.level ?? 50;
  const raw = {};
  const add = (id, v) => {
    raw[id] = (raw[id] ?? 0) + Number(v || 0);
  };

  const baseStats = [...(build.stats ?? [1, 1, 1, 1, 1, 1])];
  const addPreConversion = (id, v) => {
    const numId = Number(id);
    if (numId >= 1 && numId <= 6) baseStats[numId - 1] += Number(v || 0);
    else add(numId, v);
  };

  // Equipment base + affixes + enchants
  for (const [id, v] of build.equipmentAttrs ?? []) addPreConversion(id, v);
  for (const [id, v] of build.affixAttrs ?? []) addPreConversion(id, v);
  for (const [id, v] of build.enchantAttrs ?? []) addPreConversion(id, v);

  // Cards (see cardEffects); the op 8 conversions of their special effects run with the stunts' below
  const cardFx = cardEffects(build.cards, data);
  for (const [id, v] of cardFx.attrs) addPreConversion(id, v);

  // Gear (see gearEffects): base attributes, entries, grid levels; its stunts count with the stunts below
  const gearFx = gearEffects(build.gear, data);
  for (const [id, v] of gearFx.attrs) addPreConversion(id, v);

  // Pets (see petStats): the stats the deployed and support pets share with you
  for (const [id, v] of petStats(build.pets, build.assistPets, level, data)) addPreConversion(id, v);

  // EquipmentStunts.FlatAttributes (ops 1, 4, 5)
  const stunts = [...(build.stunts ?? []), ...gearFx.stunts, ...cardFx.stunts];
  const totalStuntCount = (build.stunts ?? []).length + gearFx.count;
  for (const st of stunts) {
    const row = typeof st === 'object' && st._kSpecialEffect ? st : data.row('SpecialEffectConfig', st.id ?? st);
    if (!row || !Array.isArray(row._kSpecialEffect)) continue;
    const gridRefine = st.refine ?? build.weaponRefine ?? 0;
    for (const op of row._kSpecialEffect) {
      if (op.length === 3 && op[0] === 1) addPreConversion(op[1], op[2]);
      else if (op.length === 5 && op[0] === 4 && op[1] > 0) {
        addPreConversion(op[3], Math.trunc(Math.min(totalStuntCount, op[2]) / op[1]) * op[4]);
      } else if (op.length === 4 && op[0] === 5 && op[1] > 0) {
        addPreConversion(op[2], Math.trunc(gridRefine / op[1]) * op[3]);
      }
    }
  }

  // Weapon & grid strengthen / refine bonuses (StrengthenTable / RefiningTable); a weapon in `build.gear` brings its own
  if (!gearFx.grids.has(1) && (build.weaponStrengthen ?? 0) > 0) {
    const sLv = build.weaponStrengthen;
    add(103, sLv * 2);
    add(104, sLv * 2);
  }
  if (!gearFx.grids.has(1) && (build.weaponRefine ?? 0) > 0) {
    const rBonus = WEAPON_REFINE_BONUS[build.weaponRefine] ?? build.weaponRefine * 24;
    add(103, rBonus);
    add(104, rBonus);
  }

  // Cards, Emblems, Season Talents, Passive Skills, Season Refine, Mount, Pets, Totems
  for (const [id, v] of build.cardAttrs ?? []) addPreConversion(id, v);
  for (const [id, v] of build.emblemAttrs ?? []) addPreConversion(id, v);
  for (const [id, v] of build.talentAttrs ?? []) addPreConversion(id, v);
  for (const [id, v] of talentEffects(build, data).attrs) addPreConversion(id, v); // the Season Talent tree (see talentEffects)
  for (const skillId of build.passiveSkills ?? []) {
    const sRow = data.row('SkillConfig', skillId);
    if (sRow && Number(sRow._iBasicType) === 0 && Array.isArray(sRow._kAttri)) {
      for (const [id, v] of sRow._kAttri) addPreConversion(id, v);
    }
  }
  for (const [id, v] of build.extraAttrs ?? []) addPreConversion(id, v);
  if (build.resonance) {
    // Every attribute of the reached rows, like the server: Damage Increase and Elemental Counter Ignore reach the damage, Max HP% the
    // sheet's HP; Healing Done, Damage Reduction and Counter Resist are panel numbers.
    for (const [id, v] of resonanceEffects(build.resonance.refine, build.resonance.enhance, data).attrs) addPreConversion(id, v);
  }

  // Deployed Totem attributes (TotemService.Attributes + TotemEffects.Attributes)
  for (const [id, v] of evaluateTotemAttributes(build, data, skipTotemOp10)) {
    addPreConversion(id, v);
  }

  for (let i = 0; i < 6; i++) add(i + 1, baseStats[i]);

  // Active Buffs (BuffService: b.Changes)
  for (const buff of asArray(build.activeBuffs)) {
    const bRow = typeof buff === 'object' && buff._kChangeAttri ? buff : data.row('BuffConfig', buff.id ?? buff);
    const piles = buff.piles ?? 1;
    for (const [id, v] of asPairs(bRow?._kChangeAttri)) {
      add(id, v * piles);
      // ponytail: STR..LUK from a buff also feed the per-point conversions below, like gear stats (the server code does not do this).
      if (id >= 1 && id <= 6) baseStats[id - 1] += v * piles;
    }
  }

  // AttriBaseLvConfig[career * 1000 + level] with Novice fallback
  const baseLvRow =
    data.row('AttriBaseLvConfig', career * 1000 + level) ??
    data.row('AttriBaseLvConfig', 1000 * 1000 + level) ??
    interpolateBaseLvRow(career, level, data);
  for (const [id, v] of asPairs(baseLvRow?._kAttri)) add(id, v);

  // JobConfig._kAttri
  const jobRow = data.row('JobConfig', career);
  for (const [id, v] of asPairs(jobRow?._kAttri)) add(id, v);

  // AttributeConversionConfig per point of STR..LUK
  const ranged = jobRow && Number(jobRow._iDistanceType) === 2;
  for (let stat = 1; stat <= 6; stat++) {
    const conv = data.row('AttributeConversionConfig', stat);
    if (!conv) continue;
    const list = ranged ? conv._kAttribute2 : conv._kAttribute1;
    for (const [id, perPoint] of asPairs(list)) add(id, perPoint * baseStats[stat - 1]);
  }

  if (raw[113] === undefined) raw[113] = 700;
  if (raw[115] === undefined) raw[115] = 100;

  // EquipmentStunts.ApplyConversions (ops 8 and 14 read one pre-conversion snapshot)
  let sheet = computeStatSheet(raw, data);
  let converted = false;
  for (const st of stunts) {
    const row = typeof st === 'object' && st._kSpecialEffect ? st : data.row('SpecialEffectConfig', st.id ?? st);
    if (!row || !Array.isArray(row._kSpecialEffect)) continue;
    for (const op of row._kSpecialEffect) {
      let source = 0, step = 0, target = 0, perStep = 0, cap = 0;
      if (op.length === 6 && op[0] === 8) {
        [source, step, target, perStep, cap] = [sheet[op[1]], op[2], op[3], op[4], op[5]];
      } else if (op.length === 7 && op[0] === 14) {
        [source, step, target, perStep, cap] = [sheet[op[1]] + sheet[op[2]], op[3], op[4], op[5], op[6]];
      } else continue;
      const val = step <= 0 ? 0 : Math.min(Math.floor(source / step) * perStep, cap);
      add(target, val);
      converted = true;
    }
  }
  const aspdExcess = sheet[115] - ASPD_EXCESS.cap;
  if (aspdExcess > 0) {
    add(1031, Math.min(aspdExcess * ASPD_EXCESS.bpPerPoint, ASPD_EXCESS.maxBp));
    converted = true;
  }
  if (converted) sheet = computeStatSheet(raw, data);
  // The panel's HP recover / SP Recovery are the flat value plus a share of Max HP / Max SP (Recovery % 1071 / 1081 in basis points, which VIT and INT
  // feed too: CombatService.RegenAsync), rounded up: a Lv 72 Ranger's 487 + 45 + 0.15% of 176,086 HP = 796.1 shows 797 in the game.
  sheet.data[107] = Math.ceil(sheet[107] + (sheet[101] * sheet[1071]) / 10000 - 1e-6);
  sheet.data[108] = Math.ceil(sheet[108] + (sheet[102] * sheet[1081]) / 10000 - 1e-6);
  sheet.data[2000] = Math.min(build.currentHp ?? sheet[101], sheet[101]);
  sheet.data[2001] = Math.min(build.currentSp ?? sheet[102], sheet[102]);
  sheet.data[2002] = level;
  return sheet;
}

/**
 * Where a number of the sheet comes from. `steps` lists the sources of `build` as [name, patch], `patch` being the build keys that source brings
 * (a source may redo a key an earlier one set: the gear without its Refine / Enhance levels, then with them); the base is `build` without any of
 * those keys. Returns the sheets as the sources join, [base, + step 1, + steps 1-2, ...]: what a source adds is the difference of two neighbours,
 * on top of the sources before it (a percent bonus lifts what came earlier and counts with the source that brings it), so the shares add up to
 * the last sheet, which is `build`'s own when the patches restore every key.
 */
export function sheetSteps(build, steps, data = new Ro3DataStore()) {
  let b = { ...build };
  for (const [, patch] of steps) for (const key of Object.keys(patch)) delete b[key];
  const sheets = [buildCharacterStats(b, data)];
  for (const [, patch] of steps) sheets.push(buildCharacterStats((b = { ...b, ...patch }), data));
  return sheets;
}

function interpolateBaseLvRow(career, level, data) {
  const ref50 = data.row('AttriBaseLvConfig', career * 1000 + 50) ?? data.row('AttriBaseLvConfig', 1000050);
  if (!ref50) return null;
  const ratio = level / 50;
  return {
    _kAttri: ref50._kAttri.map(([id, v]) => [id, Math.max(1, Math.round(v * ratio))]),
  };
}

// ============================================================================
// 3. Totem Effects & Skill Parameter Rules (`TotemEffects.cs`, `SkillParameterRules.cs`)
// ============================================================================

// The deployed totems' skills that take effect (TotemEffects.Effective): a skill is dropped when a superior one is deployed anywhere,
// and a non-coexisting skill counts once across the lineup. Yields { totem, skills (the totem's list), ops } per effective skill.
function* totemEffectiveSkills(build, data) {
  const totems = asArray(build.totems);
  const allSkills = new Set(totems.flatMap((t) => asArray(t.skills)));
  const used = new Set();
  for (const totem of totems) {
    const skills = asArray(totem.skills);
    for (const skillId of skills) {
      const row = data.row('TotemSkillConfig', skillId);
      if (!row) continue;
      let superior = row._iSuperiorSkillID, superseded = false;
      const seen = new Set();
      while (superior && !seen.has(superior)) {
        if (allSkills.has(superior)) { superseded = true; break; }
        seen.add(superior);
        superior = data.row('TotemSkillConfig', superior)?._iSuperiorSkillID;
      }
      if (superseded || !row._iIsCoexist && used.has(skillId)) continue;
      used.add(skillId);
      const opLists = asArray(row._kSpecialAttribute)
        .map((specId) => data.row('SpecialEffectConfig', specId)?._kSpecialEffect)
        .filter(Array.isArray)
        .map((list) => list.filter(Array.isArray));
      yield { totem, skills, row, opLists };
    }
  }
}

// Opcode-2 passive -> on-cast temporary stack buff (TotemEffects.CastStacks).
export const TOTEM_CAST_STACKS = { 2500101: 2500301, 2500201: 2500401, 2500501: 2500701, 2500601: 2500801, 2500901: 2501101, 2501001: 2501201, 2501301: 2501501, 2501401: 2501601 };
const TOTEM_EXTRA_HIT = { 2504001: true, 2514001: true, 2515701: false, 2507501: false }; // passive -> magic

/**
 * The deployed totems' combat passives (TotemEffects.OnCastAsync / StackCap / ExtraDamage):
 * castStacks [{ guid, buffId, durMs, cap }] and extraHits [{ guid, passiveId, magic }].
 * ponytail: the execute passives (below 30% target HP) are left out because the simulated target stays at full HP; 2501401 (healing
 * casts only) and the per-stack 2530401-2530701 bonuses are not modeled either.
 */
export function totemPassives(build, data = new Ro3DataStore()) {
  const perTotem = new Map();
  for (const { totem, opLists } of totemEffectiveSkills(build, data)) {
    const guid = totem.guid ?? 1;
    if (!perTotem.has(guid)) perTotem.set(guid, { passives: new Set(), maxStack: [] });
    const t = perTotem.get(guid);
    for (const op of opLists.flat()) {
      if (op.length === 2 && op[0] === 2) t.passives.add(op[1]);
      else if (op.length === 3 && op[0] === 18) t.maxStack.push([op[1], op[2]]);
    }
  }
  const castStacks = [], extraHits = [];
  for (const [guid, { passives, maxStack }] of perTotem) {
    for (const passiveId of passives) {
      if (passiveId in TOTEM_EXTRA_HIT) extraHits.push({ guid, passiveId, magic: TOTEM_EXTRA_HIT[passiveId] });
      const buffId = TOTEM_CAST_STACKS[passiveId];
      if (!buffId || passiveId === 2501401) continue;
      const durMs = Number(data.row('BuffConfig', passiveId)?._kLogicData?.[0] ?? 0);
      const active = data.row('BuffConfig', buffId);
      const cats = asArray(active?._kBuffCategory);
      const cap = Math.max(1, Number(active?._iMaxStack ?? 2)) + maxStack.filter(([cat]) => cats.includes(cat)).reduce((a, [, n]) => a + n, 0);
      if (durMs > 0) castStacks.push({ guid, buffId, durMs, cap });
    }
  }
  return { castStacks, extraHits };
}

export function evaluateTotemAttributes(build, data = new Ro3DataStore(), skipOp10 = false, precomputedMaxHp = null) {
  const out = [];
  const totems = asArray(build.totems);
  if (totems.length === 0) return out;
  for (const totem of totems) {
    const enhanceMult = 1 + (totem.enhanceBp ?? 0) / 10000;
    for (const [id, v] of asPairs(totem.attrs)) out.push([id, v * enhanceMult]);
  }
  for (const { totem, skills, row, opLists } of totemEffectiveSkills(build, data)) {
      for (const [id, v] of asPairs(row._kBasicAttribute)) out.push([id, v]);
      for (const ops of opLists) {
        for (const op of ops) {
          if (op.length === 3 && op[0] === 1) out.push([op[1], op[2]]);
          else if (op.length === 4 && op[0] === 7 && op[1] > 0) {
            out.push([op[2], Math.trunc(skills.length / op[1]) * op[3]]);
          } else if (op.length === 3 && op[0] === 9) {
            out.push([op[1], Math.floor((build.level ?? 50) * op[2] / 10000)]);
          } else if (op.length === 7 && op[0] === 10 && !skipOp10) {
            const maxHp = precomputedMaxHp ?? buildCharacterStats(build, data, true)[101];
            const hp = build.currentHp ?? maxHp;
            const q = op[2] === 1 ? (maxHp > 0 ? Math.floor((hp * 10000) / maxHp) : 0) : hp;
            const active =
              op[1] === 1 ? q > op[3] :
              op[1] === 2 ? q >= op[3] :
              op[1] === 3 ? q < op[3] :
              op[1] === 4 ? q <= op[3] :
              op[1] === 5 ? q === op[3] : false;
            if (active) {
              out.push([op[4], op[5] === 2 ? Math.floor((build.level ?? 50) * op[6] / 10000) : op[6]]);
            }
          } else if (op.length >= 8 && op[0] === 12 && op[1] === 1 && op[3] === 2) {
            const op1 = ops.find((x) => x.length === 3 && x[0] === 1);
            const attr = op1 ? op1[1] : 0;
            const floors = totemFloorStacks(build, totem.guid ?? 1, op[2], data);
            if (attr !== 0 && floors > 0) out.push([attr, floors * op[5]]);
          }
        }
      }
  }
  return out;
}

function totemFloorStacks(build, sourceGuid, category, data) {
  let sum = 0;
  for (const b of build.activeBuffs ?? []) {
    if (!b.isTotemOwned || b.isPassive || (b.sourceId ?? 1) !== sourceGuid) continue;
    const row = typeof b === 'object' && b._kBuffCategory ? b : data.row('BuffConfig', b.id ?? b);
    if (row && Array.isArray(row._kBuffCategory) && row._kBuffCategory.includes(category)) {
      sum += b.piles ?? 1;
    }
  }
  return sum;
}

/**
 * The skill fields a buff's `_kSkillAttributeList` [scope, selector, type, op, value] tuple can change, by its type (the protocol's SkillAffectValueType);
 * other types are not simulated. Type 10, SkillCriticalProb, adds crit chance to the skill: `_iCritAdd` (basis points) is read by `calcCritRate`.
 * ponytail: "gains 35% Crit Chance" is taken as +35 points of crit chance, not 35% more of the character's own (the exported rows give no scale).
 */
export const SKILL_MODIFIER_FIELDS = {
  0: '_iCD',
  10: '_iCritAdd',
  21: '_iActionTime',
  23: '_iChantFix',
  24: '_iChantVar',
  25: '_iDistanceMin',
  26: '_iDistanceMax',
  27: '_iTargetMax',
  29: '_kDamageParam1',
  30: '_kDamageParam2',
};

export function applySkillParameterRules(skillRow, activeBuffs = [], data = new Ro3DataStore()) {
  const group = Number(skillRow._iSkillID || 0);
  const categories = asArray(skillRow._kSkillCategory).map(Number);
  const modifiers = [];
  for (const buff of activeBuffs) {
    const bRow = typeof buff === 'object' && buff._kSkillAttributeList ? buff : data.row('BuffConfig', buff.id ?? buff);
    if (!bRow || !Array.isArray(bRow._kSkillAttributeList)) continue;
    const piles = buff.piles ?? 1;
    for (const tuple of bRow._kSkillAttributeList) {
      if (!Array.isArray(tuple) || tuple.length < 5) continue;
      // Scope 0 names a skill group. Scope 1 names a skill category (`_kSkillCategory`): Unlimited Shooting's
      // [1, 3105, 29, 5, 5000] is its "+50% Aimed Shot damage" and 3105 is in every Focused Arrow Strike row.
      const selector = Number(tuple[1]);
      if (Number(tuple[0]) === 0 ? selector !== group : Number(tuple[0]) !== 1 || selector <= 0 || !categories.includes(selector)) continue;
      const type = Number(tuple[2]);
      const op = Number(tuple[3]);
      const value = Number(tuple[4]);
      const index = tuple.length > 5 ? Number(tuple[5]) : 0;
      for (let i = 0; i < piles; i++) modifiers.push({ group, type, op, value, index });
    }
  }
  if (modifiers.length === 0) return skillRow;

  const applyOp = (val, mod) => {
    if (mod.op === 1) return val + mod.value;
    if (mod.op === 2) return mod.value;
    if (mod.op === 5) {
      // MidpointRounding.AwayFromZero
      const prod = val * (1 + mod.value / 10000);
      return prod >= 0 ? Math.floor(prod + 0.5) : Math.ceil(prod - 0.5);
    }
    return val;
  };

  const clone = { ...skillRow };
  for (const mod of modifiers) {
    const field = SKILL_MODIFIER_FIELDS[mod.type];
    if (!field) continue;
    if (mod.type === 29 || mod.type === 30) {
      if (!Array.isArray(clone[field])) continue;
      clone[field] = clone[field].slice();
      const first = mod.index < 0 ? 0 : mod.index;
      const end = mod.index < 0 ? clone[field].length : Math.min(clone[field].length, first + 1);
      for (let i = first; i < end; i++) {
        clone[field][i] = applyOp(Number(clone[field][i] || 0), mod);
      }
    } else {
      clone[field] = applyOp(Number(clone[field] || 0), mod);
    }
  }
  return clone;
}

// ============================================================================
// 3b. Skill damage the rows cannot express (verified against the in-game skill texts by `node build-ro3-sim.mjs`)
// ============================================================================

const repeat = (branch, n) => Array(n).fill(branch);

/**
 * Per-skill facts, keyed by skill group (`_iSkillID`). A row holds ONE damage instance's multiplier per branch
 * (`_kDamageParam1[branch]`, `_kDamageParam2[branch]`); the in-game text states the whole cast:
 *  hits      branch of every damage instance of one cast. Myriad Stars Chase the Moon: 7 x 200%, the text says 1400%.
 *  vsMonster branch used against monsters: "Against Monsters, the percentage DMG multiplier increases by X%".
 *  both      adds M.ATK to the P.ATK base: "Physical ATK*50% + Magic ATK*50% + 60".
 */
export const SKILL_MODEL = {
  13003: { hits: repeat(0, 2) }, // Double Strafe: 2 hits of 100% + 75
  // `modes` is the same per row of a skill mode (SEASON_BUFFS): Focused Arrow Strike in Unlimited Shooting with Infinite Rhapsody casts a 60% hit and a 15% one,
  // Myriad Stars with Celestial Symphony 10 hits of 200% and a 150% one at the end.
  13305: { modes: { 4: { hits: [0, 1] } } },
  113303: { hits: [0, 1] }, // Gale Beat's enhanced cast in that Unlimited Shooting mode: 75% and 15%
  13320: { hits: repeat(0, 7), modes: { 1: { hits: [...repeat(0, 10), 1] } } }, // Myriad Stars Chase the Moon
  15210: { both: true }, // Soul Destroyer
  15326: { hits: [0, 1] }, // Piercing Shadow: 150% + 150%
  16304: { hits: [...repeat(0, 6), 1] }, // Axe Tornado: 6 x 167% + a 250% finisher
  16306: { hits: repeat(0, 2) }, // Spinning Axe: 2 x 100%
  16312: { hits: repeat(0, 2) }, // Arm Cannon: 2 x 40%
  16318: { hits: repeat(0, 7) }, // Aerial Bombardment: 7 x 300%
  13327: { hits: repeat(0, 4) }, // Warg Companion (Warg Strike), King of the Wargs: 4 x 80%
  11608: { vsMonster: 1 }, // Shield Press: +100%
  11611: { vsMonster: 1 }, // Earth Drive: +100%
  11636: { vsMonster: 1 }, // Powerful Shield Bash: +50%
};

/**
 * Buff-triggered extra hits, keyed by buff family (`_iID / 100`). While the buff is up, every hit of a skill carrying `tag`
 * (SkillTagConfig 702 = Bow) has the buff's chance (`_kLogicData[0]`, basis points) to add hits that total `_kDescData[2]`% of
 * P.ATK as Neutral ranged Physical damage. Fear Breeze: "when a targeted bow skill hits, the target has a 30% Chance to be
 * struck by piercing arrows, taking 3 hits ... totaling Physical ATK*50%".
 */
export const BUFF_PROCS = { 13301: { tag: 702, name: 'Fear Breeze' } };

function buffProcRow(buffRow, rule) {
  return {
    _iID: -Number(buffRow._iID), _iSkillID: -Number(buffRow._iID), name: rule.name, _iBasicType: 1, _iDmgType: 1, _iEleType: 1,
    _iDistanceType: 2, _iSkillHit: 10000, _iSkillCri: 10000, _iActionTime: 0, _kDamageParam1: [Number(buffRow._kDescData?.[2] ?? 0) * 100],
  };
}

/**
 * A learned skill that casts itself when another skill is cast, at most once per `icdMs`. Warg Strike: "every 2.5 seconds, using
 * Focused Arrow Strike casts this skill on the target, dealing PATK * 30%". The follow-up is the skill's row of `mode` (row id =
 * group * 100 + mode * 10 + level; Warg Strike's mode 1 is the Charge you cast yourself). It needs `build.skillLevels[group] > 0`.
 * Confirmed by the player: it fires whether or not the Demonic Wolf is ridden, while the Falcon's Blitz Beat proc (basic attacks only)
 * does not fire from Focused Arrow Strike, so nothing models that proc.
 */
export const FOLLOW_UPS = { 13305: { group: 13312, mode: 0, icdMs: 2500 } };

/**
 * A buff a learned passive casts on you by itself, every `periodMs` while the passive is learned, each lasting `durMs`. Wolf Taming:
 * "When the Demonic Wolf is not mounted and follows the Ranger, it howls every 30 sec, increasing the Ranger's Physical ATK by 5% for
 * 10 sec". The wolf's WolfRoar skill (group 13321) applies buff 1332501 for those 10 s (Physical ATK +5% in the buff layer 1032).
 * ponytail: the cadence is the text's 30 s; the skill row's own cooldown says 10 s and nothing in the exported config schedules it.
 * Needs `build.skillLevels[group] > 0`. `build.periodicStartMs` is when the first one lands (default 0: the fight starts as the wolf
 * howls); `build.periodicOff` drops them all (the wolf is ridden, so it does not howl).
 */
export const PERIODIC_BUFFS = { 13310: { buff: 1332501, periodMs: 30000, durMs: 10000, name: 'Warg Howl' } };

/**
 * The Warg Hunter kit (Demonic Wolf). All of it is quoted from the in-game texts (`node build-ro3-sim.mjs` checks them):
 *  COOLDOWN_RESETS    Warg Bite "resets the Cooldown of Warg Hunt".
 *  MOUNTED_ONLY       King of the Wargs, Warg Hunt, Warg Bite and Swift Warg "can only be used while mounted on the Demonic Wolf".
 *  KING_OF_THE_PACK   For 6 s after King of the Wargs, Warg Hunt becomes Enhanced Warg Hunt (skill mode 1, 310% instead of 150%), and
 *                     casting Warg Charge or Warg Bite also sends the wolf followers (skill groups 13327: 4 hits totaling 320% and
 *                     13328: 3 hits totaling 240%, at King of the Wargs' level).
 * `build.ridden === false` (the wolf follows you instead) turns the mounted-only skills off, and Warg Charge then loses the 10% Physical
 * DMG it grants "if you are riding"; an unset `ridden` leaves everything allowed. ponytail: the 50% extra damage the mode-1 King of
 * the Wargs buff names for non-player enemies is not applied (its text row says so, the player-facing skill text does not).
 */
export const COOLDOWN_RESETS = { 13325: [13323] };
export const MOUNTED_ONLY = new Set([13322, 13323, 13325, 13326]);
export const RIDING_BUFF_ONLY = new Set([13312]);
export const KING_OF_THE_PACK = { group: 13322, family: 13326, enhance: { 13323: 1 }, extras: { 13312: 13327, 13325: 13328 } };
/**
 * Wolf's Fang (skill group 13311): "While mounted on the Demonic Wolf, Physical ATK increases by 10%, and the percentage damage
 * multipliers of Warg Charge, Warg Bite, and Warg Hunt increase by 10%". Its effect is the buff of the family below (buff id = family *
 * 100 + the skill's level: +P.ATK% and a +% to the damage of skill category 3103), which the caller adds to `activeBuffs` while riding.
 */
export const RIDING_PASSIVES = { 13311: 13312 };

/**
 * The Season (playbook 101) Ranger skills. Their rows carry no effect of their own: while one is learned the client keeps the "Shooting: BD" buff
 * of the same number on you (`SEASON_BUFFS`, skill group -> buff id), and a buff's skill attribute of type 15 changes the MODE of a skill (op 1 adds
 * to it, op 2 sets it), which is a row of its own: the row cast is group * 100 + mode * 10 + level (`skillMode`). Texts (`node build-ro3-sim.mjs` checks them):
 *  Rhythmic Arrow 113360      "Focused Arrow Strike's damage multiplier increases by 3%": its buff adds 300 to the multiplier, puts the skill in mode 2
 *                             (a quicker animation) and Unlimited Shooting in mode 1.
 *  Infinite Rhapsody 113361   "While Unlimited Shooting is active, Aimed Shot deals 1 hit of 15%": its buff adds 1 to Unlimited Shooting's mode, so with
 *                             Rhythmic Arrow it is mode 2, whose buff sets Focused Arrow Strike to mode 4 (a 60% hit and a 15% one).
 *  Gale Beat 113362           "Casting Focused Arrow Strike 4 times will Enhance the next one: 75%" (stack buff 11330401, max 4): `GALE_BEAT`. The enhanced
 *                             cast is skill 113302, or 113303 in Focused Arrow Strike's mode 4 (75% and the 15% hit). It follows up like Focused Arrow Strike.
 *  Celestial Symphony 113363  "Myriad Stars Chase the Moon's duration increases by 1 second. When it ends it deals one instance of 150%": its buff puts
 *                             the skill in mode 1, 10 hits of 200% and the 150% one over a 3.3 s animation (instead of 7 hits over 2.4 s).
 */
export const SEASON_BUFFS = { 113360: 11330101, 113361: 11330201, 113363: 11330701 };
export const GALE_BEAT = { group: 113362, trigger: 13305, casts: 4, enhanced: [113302, 113303] };
// The skills whose mode a Season buff switches. ponytail: other classes' mode buffs (talents, Warg Hunt) are not followed, so their results stay as they were.
export const SEASON_MODE_GROUPS = new Set([13305, 13307, 13320]);
const SKILL_MODE_ATTR = 15;

/** The mode `group` is cast in: the sum of the "add" buffs, or the value a "set" buff gives (a set wins). `buffs` are ids or { id, piles }. */
export function skillMode(group, buffs, data) {
  let add = 0;
  let set = null;
  for (const buff of buffs) {
    const row = typeof buff === 'object' && buff._kSkillAttributeList ? buff : data.row('BuffConfig', buff.id ?? buff);
    for (const t of asArray(row?._kSkillAttributeList)) {
      if (!Array.isArray(t) || Number(t[0]) !== 0 || Number(t[1]) !== group || Number(t[2]) !== SKILL_MODE_ATTR) continue;
      if (Number(t[3]) === 2) set = Number(t[4]);
      else if (Number(t[3]) === 1) add += Number(t[4]) * (buff.piles ?? 1);
    }
  }
  return set ?? add;
}

/** The branches of the damage instances one cast of this row lands (SKILL_MODEL), by its mode. */
export const hitsOf = (row) => {
  const model = SKILL_MODEL[Number(row._iSkillID)];
  return model?.modes?.[Number(row._iMode) | 0]?.hits ?? model?.hits ?? [undefined];
};

/**
 * Pets (1 Primary Battle slot + 3 Utility slots deployed, 5 Support slots). The pet in the Primary slot gives you its Primary Battle
 * Skill from _iProtectSkill, scaling off the OWNER, independently of the owner's rotation. Utility passives react either to its cast
 * or to its actual damage markers; they never react recursively to one another. Digest `star[].primary` carries damage markers and
 * owner buffs; p/c and pa/ca carry the ${n} and @{n} description numbers. Only the lowest Utility slot with a core activates that core.
 * ponytail: this is a stationary single-target model, without crowd control or pet actors. Unmodeled conditional effects are listed in
 * the pet window; Radiant Moon's target Ranged vulnerability still uses the existing owner Ranged-damage buff approximation.
 */
export const PET_EFFECTS = {
  30001: { passive: { on: ['offense'], when: 'hit', attr: 1229, pct: 2, sec: 1 } },
  30401: { passive: { on: 'any', attr: 1215, pct: 1, sec: 2 }, core: { on: 'any', attr: 1215, pct: 1, sec: 2, share: true } },
  30005: { passive: { on: ['offense', 'debuff'], attr: 1032, pct: 1, sec: 2 } },
  10001: { passive: { on: ['buff'], extend: 1 } },
  20003: { passive: { on: ['offense'], multiplier: 1 } },
  30101: { passive: { on: ['offense'], multiplier: 1 } },
  31002: { passive: { on: ['offense', 'recovery'], multiplier: 1 } },
  32401: { passive: { on: 'any', hit: ($) => $(3), damageGroup: 23176, melee: true, note: 'Slash damage is modeled; its target DEF reduction is not.' } },
  30004: { passive: { on: ['offense', 'debuff'], when: 'hit', hit: ($, a) => $(1) / a[0], count: ($, a) => a[0], damageGroup: 23347, ele: 4 } },
  30002: { passive: { on: ['offense', 'buff'], hit: ($) => $(5), count: ($) => $(4), step: ($) => $(1) * 1000, damageGroup: 23114 } },
  20001: { passive: { on: ['offense', 'control'], when: 'hit', icdMs: 200, hit: ($) => $(2), count: ($) => $(1), damageGroup: 23375, ele: 4, melee: true } },
  31003: { passive: { on: ['buff'], hit: ($) => $(6), count: ($) => Math.floor($(1) / $(3)), step: ($) => $(3) * 1000, delay: ($) => $(3) * 1000, damageGroup: 23087, melee: true } },
  32002: { passive: { on: ['debuff', 'control'], ownerHit: true, hit: ($) => $(2), sec: 1, icd: 3, damageGroup: 23276, melee: true } },
};

/** Relative events for one Primary cast, repeated on its cooldown without locking the character. */
export function petEffects(pets, data) {
  const out = { timedBuffs: [], hits: [], ownerHits: [], modifiers: [], notes: [], casts: [] };
  const slots = asArray(pets).map((p, i) => {
    const row = p?.id ? data.row('PetDigest', p.id) : null;
    return row ? { i, row, id: Number(row._iID), st: row.star[Math.max(1, Math.min(6, Math.trunc(p.star) || 1)) - 1] } : null;
  });
  const main = slots[0];
  if (!main) return out;
  const primary = main.st.primary;
  const periodMs = primary?.cd ?? main.row.cd;
  if (!(periodMs > 0)) return out;
  const types = new Set(main.row.types);
  const eligible = (e) => e.on === 'any' || e.on.some((t) => types.has(t));
  const utility = slots.slice(1, 4).filter(Boolean);
  const extension = utility.reduce((sum, s) => {
    const e = PET_EFFECTS[s.id]?.passive;
    if (!e?.extend || !eligible(e)) return sum;
    const extraMs = Number(s.st.p[e.extend - 1]) * 1000;
    out.modifiers.push({ slot: s.i, name: s.row.pas.name, extraMs });
    return sum + extraMs;
  }, 0);
  const multiplier = 1 + utility.reduce((sum, s) => {
    const e = PET_EFFECTS[s.id]?.passive;
    if (!e?.multiplier || !eligible(e)) return sum;
    const pct = Number(s.st.p[e.multiplier - 1]);
    out.modifiers.push({ slot: s.i, name: s.row.pas.name, pct });
    return sum + pct / 100;
  }, 0);
  for (const b of primary?.buffs ?? []) out.timedBuffs.push({ slot: 0, name: main.row.main.name, ...b, durMs: b.durMs + extension, periodMs });
  const primaryHits = [...(primary?.hits ?? [])];
  if (primary?.tickMs && extension > 0 && primaryHits.length) {
    const last = primaryHits.at(-1);
    for (let at = last.at + primary.tickMs; at <= last.at + extension; at += primary.tickMs) primaryHits.push({ ...last, at });
  }
  for (const [primaryIndex, h] of primaryHits.entries()) {
    const name = `${main.row.name}: ${main.row.main.name}`;
    const row = { ...primary.row, name, _kDamageParam1: [h.ratio * multiplier], _kDamageParam2: [] };
    out.hits.push({ slot: 0, name, pct: h.ratio * multiplier / 100, periodMs, firstMs: h.at, row, primary: true, primaryIndex });
  }
  out.casts.push({ id: primary?.id, name: `${main.row.name}: ${main.row.main.name}`, periodMs, firstMs: 0, hits: primaryHits.map((h) => h.at) });
  for (const text of primary?.notes ?? []) out.notes.push({ slot: 0, text });
  const coreSlot = utility.find((s) => s.row.core);
  for (const s of utility) {
    if (s.row.core && s !== coreSlot) out.notes.push({ slot: s.i, text: 'Core inactive: an earlier Utility slot already supplies the core.' });
    for (const kind of ['passive', 'core']) {
      const e = PET_EFFECTS[s.id]?.[kind];
      if (kind === 'core' && s !== coreSlot) continue;
      if (!e) {
        if (kind === 'core' && s.row.core) out.notes.push({ slot: s.i, text: 'This core effect is not simulated.' });
        continue;
      }
      if (!eligible(e) || e.extend || e.multiplier) continue;
      if (e.note) out.notes.push({ slot: s.i, text: e.note });
      const d = kind === 'core' ? s.st.c : s.st.p;
      const alt = (kind === 'core' ? s.st.ca : s.st.pa) ?? [];
      const $ = (n) => Number(d?.[n - 1]);
      const name = kind === 'core' ? s.row.core.name : s.row.pas.name;
      const triggers = e.when === 'hit' ? out.hits.filter((h) => h.primary).map((h) => ({ t: h.firstMs, index: h.primaryIndex })).sort((a, b) => a.t - b.t) : [{ t: 0 }];
      let ready = -Infinity;
      const offsets = triggers.filter(({ t }) => { if (t < ready) return false; ready = t + (e.icdMs ?? 0); return true; });
      if (e.attr) {
        if (e.when === 'hit' && primary?.row?._iSkillHit < 10000) {
          out.notes.push({ slot: s.i, text: 'This hit-triggered buff is not modeled for a Primary skill that can miss.' });
          continue;
        }
        const durMs = Math.round($(e.sec) * 1000);
        const windows = [];
        for (const { t } of offsets) {
          const prev = windows.at(-1);
          if (prev && t <= prev.firstMs + prev.durMs) prev.durMs = t + durMs - prev.firstMs;
          else windows.push({ firstMs: t, durMs });
        }
        for (const w of windows) out.timedBuffs.push({ slot: s.i, name, attrs: [[e.attr, Math.round($(e.pct) * 100)]], periodMs, afterHit: e.when === 'hit', ...w });
      }
      if (e.hit) {
        const pct = e.hit($, alt);
        const id = -(9000000 + s.id + (kind === 'core' ? 100000 : 0));
        const row = { _iID: id, _iSkillID: id, name: `${s.row.name}: ${name}`, _iBasicType: 1, _iDmgType: 4, _iEleType: e.ele ?? 1, _iDistanceType: e.melee ? 1 : 2,
          _iSkillHit: s.st.passiveRow?._iSkillHit ?? 10000, _iSkillCri: s.st.passiveRow?._iSkillCri ?? 10000, _iActionTime: 0, _kDamageParam1: [pct * 100] };
        if (e.ownerHit) out.ownerHits.push({ slot: s.i, name: row.name, pct, periodMs, firstMs: 0, durMs: $(e.sec) * 1000, icdMs: $(e.icd) * 1000, row });
        else for (const { t, index } of offsets) for (let i = 0; i < (e.count?.($, alt) ?? 1); i++) {
          out.hits.push({ slot: s.i, name: row.name, pct, periodMs, firstMs: t + (e.delay?.($) ?? 0) + i * (e.step?.($) ?? 0), row, requiresPrimary: index });
        }
      }
      if (e.share && primaryHits.length && alt[1] > 0) {
        out.hits.push({ slot: s.i, name: `${s.row.name}: ${name} (extra damage)`, periodMs, firstMs: Math.max(...primaryHits.map((h) => h.at)), sharePct: alt[1] / 100, id: -(9100000 + s.id) });
      }
    }
  }
  return out;
}

/**
 * The stats a pet shares with its master, as the client's "Stat Bonus Overview" adds them up (UI_Sys_Pet_GrowthPreviewPanelCtrl):
 * the pet's own stats at its level (`PetGrowth` row of its growth group: HP, SP, P.ATK, M.ATK, P.DEF, M.DEF, the stats the game says
 * "are determined by its level and growth rate"), times the rank step (`PetRules.curve`, PetStarConfig `_iBaseAttr` / 10000: 100% at
 * 1 star up to 200% at 6 stars, one curve for every pet), times the rank scale (100%), times the share of its slot (PetSetLimitConfig:
 * 100% for a deployed slot, 30% for a support slot), each attribute rounded up on its own. A pet's level cannot exceed the
 * adventurer's. `slot` is { id, star, stage, lv } for a deployed pet (`id`: a PetDigest pet) or { g, star, stage, lv } for a support
 * slot (`g`: a growth group, quality * 10 + faction: pets of one group have the same stats, and a support pet gives nothing else);
 * `stage` 0..3 is the rank-up progress inside a star (none at 6 stars). A slot without `lv` gives no stats.
 * ponytail: the faction bonus (3 deployed pets of one faction: +15% Max HP on them) and the codex bonuses of pets you own (PetStarConfig
 * `_kCollectAttr`, mostly PvP stats) are not added; the pet stage skills (`_kStageSkill`) are empty in the data.
 */
export const PET_STAT_ATTRS = [101, 102, 103, 104, 105, 106]; // the order of a PetGrowth row's `lv` entries
export function petSlotStats(slot, kind, index, level, data) {
  const rules = data.row('PetRules', 1);
  const g = kind === 'fight' ? data.row('PetDigest', slot?.id)?.g : slot?.g;
  const grow = g ? data.row('PetGrowth', g) : null;
  if (!rules || !grow || !(Number(slot?.lv) >= 1)) return [];
  const lv = Math.max(1, Math.min(Math.trunc(slot.lv), rules.maxLv, Math.trunc(level) || 1));
  const star = Math.max(1, Math.min(6, Math.trunc(slot.star) || 1));
  const step = rules.curve[(star - 1) * 4 + (star === 6 ? 0 : Math.max(0, Math.min(3, Math.trunc(slot.stage) || 0)))];
  const scale = (kind === 'fight' ? rules.fightScale : rules.assistScale)[grow.q] ?? 10000;
  const share = (kind === 'fight' ? rules.fight : rules.assist)[index] ?? 0;
  const skip = kind === 'fight' ? rules.notAdd.fight : rules.notAdd.assist;
  return PET_STAT_ATTRS.flatMap((a, i) => {
    const v = Math.ceil(grow.lv[lv - 1][i] * (step / 10000) * (scale / 10000) * (share / 10000)); // the client's order of multiplication
    return v > 0 && !skip.includes(a) ? [[a, v]] : [];
  });
}
/** All the stats of the deployed lineup `pets` (the slots of petEffects) and the support slots `assist`: [[attribute, value]]. */
export function petStats(pets, assist, level, data) {
  const sum = new Map();
  const add = (list) => { for (const [a, v] of list) sum.set(a, (sum.get(a) ?? 0) + v); };
  asArray(pets).forEach((p, i) => p && add(petSlotStats(p, 'fight', i, level, data)));
  asArray(assist).forEach((p, i) => p && add(petSlotStats(p, 'assist', i, level, data)));
  return [...sum];
}

/**
 * When the hits of one cast land and how long the cast locks the caster, from the client's skill template (SkillTiming row
 * [chant, end, interrupt, hit points], seconds). The template's [chant, end] span is stretched over the cast's real chant + action
 * time (ASPD included), like `CombatService.ImpactOffset`. A point within one frame of the start, followed by later ones, is the
 * cast's start marker and not a hit: Myriad Stars (a 0 s marker + its 7 hits) and Aerial Bombardment (0.017 s + 7) look like that.
 * The hits then take the next points in order; a skill with more points than hits uses the first ones (the server resolves a cast
 * at its first point) and one with fewer spreads the rest evenly to the end of the animation. `cancel` ends the lock at the
 * template's interrupt frame (the earliest moment another skill may be cast) instead of the end of the animation. No template:
 * first hit at 20% of the action, like the server.
 */
export function castTimes(data, row, timing, hitCount, cancel = false) {
  const [tChant, tEnd, tInterrupt, all] = data.row('SkillTiming', row._iScriptShow) ?? [0, 1, 0, []];
  const { chantMs, actionMs } = timing;
  const fullMs = chantMs + actionMs;
  const at = (p) => Math.round(p < tChant && tChant > 0 ? (p / tChant) * chantMs : chantMs + Math.min(1, Math.max(0, (p - tChant) / Math.max(0.001, tEnd - tChant))) * actionMs);
  const lead = all.findIndex((p) => p > 0.02); // 0.02 s: one frame at 60 fps
  const points = lead > 0 ? all.slice(lead) : all;
  const first = at(points[0] ?? 0.2);
  const hitAt = points.length >= hitCount
    ? points.slice(0, hitCount).map(at)
    : Array.from({ length: hitCount }, (_, h) => Math.round(first + (h * (fullMs - first)) / hitCount));
  const cancelAt = cancel && tInterrupt > 0 ? Math.min(fullMs, Math.max(at(tInterrupt), hitAt[hitCount - 1])) : fullMs;
  return { hitAt, fullMs, lockMs: Math.max(50, cancelAt) };
}

// ============================================================================
// 4. Exact Damage Formula (`CombatService.cs`, `TotemEffects.cs`)
// ============================================================================

const ELEMENT_COLUMNS = [
  '_iNone', '_iWind', '_iEarth', '_iFire', '_iWater',
  '_iPoison', '_iHoly', '_iShadow', '_iGhost', '_iUndead',
];

export function elementFactor(attackerEle, defenderEle, data = new Ro3DataStore()) {
  if (attackerEle < 1 || attackerEle > 10) return 0;
  const row = data.row('EleConfig', defenderEle);
  if (!row) return 0;
  return Number(row[ELEMENT_COLUMNS[attackerEle - 1]] || 0);
}

export function calcHitRate(attacker, defender, skillRow) {
  if (Number(skillRow._iSkillHit || 0) >= 10000) return 1.0;
  const flee = Number(defender.flee || 0);
  const hit = Number(attacker.hit || 0);
  const raw = 1 - flee / (flee + 600) + (hit / (hit + 600)) * 0.5;
  return Math.max(0.3, Math.min(1.0, raw));
}

export function calcCritRate(attacker, defender, skillRow) {
  const magic = Number(skillRow._iDmgType) === 2;
  if (magic) return 0;
  const cri = Math.max(0, Number(attacker.cri || 0) - Number(defender.resCri || 0)) / 10000;
  const skillCri = Number(skillRow._iSkillCri ?? 10000) / 10000;
  return Math.max(0, Math.min(1.0, cri * skillCri + Number(skillRow._iCritAdd || 0) / 10000));
}

function isCritPossible(magic) {
  return !magic;
}

export function calcSkillTimingMs(statsSheet, skillRow) {
  const aspd = Math.max(0.1, Math.min(ASPD_EXCESS.cap / 100, Number(statsSheet[115] || 100) / 100));
  const influence = Number(skillRow._iActionTimeInfluence || 0) / 100;
  const actionTime = Math.max(1, Number(skillRow._iActionTime || 1000));
  const actionMs = Math.round(actionTime / Math.max(0.1, 1 + (aspd - 1) * influence));
  const chantMs = Math.max(0, Number(skillRow._iChantFix || 0) + Number(skillRow._iChantVar || 0));
  const cdMs = Math.max(0, Number(skillRow._iCD || 0));
  return { chantMs, actionMs, castLockMs: chantMs + actionMs, cdMs };
}

export function totemOutgoingMultiplier(build, skillRow, isCrit, data = new Ro3DataStore(), precomputedMaxHp = null) {
  const totemAttrs = evaluateTotemAttributes(build, data, false, precomputedMaxHp);
  const bonusOf = (attrId) => {
    let sum = totemAttrs.filter(([id]) => Number(id) === attrId).reduce((a, [, v]) => a + v, 0);
    for (const b of asArray(build.activeBuffs)) {
      if (!b.isTotemOwned || b.isPassive) continue;
      const bRow = typeof b === 'object' && b._kChangeAttri ? b : data.row('BuffConfig', b.id ?? b);
      const piles = b.piles ?? 1;
      for (const [id, v] of asPairs(bRow?._kChangeAttri)) {
        if (Number(id) === attrId) sum += v * piles;
      }
    }
    return sum;
  };
  const magic = Number(skillRow._iDmgType) === 2;
  const distType = Number(skillRow._iDistanceType || 1);
  const dmgBonus = magic ? bonusOf(213) : bonusOf(211) + bonusOf(distType === 2 ? 229 : 227);
  let factor = Math.max(0, 1 + dmgBonus / 10000);
  if (isCrit) {
    factor *= Math.max(0, (15000 + bonusOf(209)) / 15000);
  }
  return factor;
}

/**
 * Computes full single-hit damage breakdown and expected value matching `CombatService.Damage` + `ApplyEffectsAsync`.
 */
export function evaluateSkillDamage(build, defender, rawSkillRow, options = {}, data = new Ro3DataStore()) {
  const stats = options.stats ?? buildCharacterStats(build, data);
  // `rulesApplied`: the caller already ran applySkillParameterRules on this row (simulateRotation freezes the modifiers at cast time).
  const skillRow = options.rulesApplied ? rawSkillRow : applySkillParameterRules(rawSkillRow, build.activeBuffs ?? [], data);
  const model = SKILL_MODEL[Number(skillRow._iSkillID)];
  const hitBranches = hitsOf(skillRow);
  const branch = skillRow._kScriptLogic === 'Heal' ? 1 : (options.branch ?? model?.vsMonster ?? 0);
  const magic = Number(skillRow._iDmgType) === 2 || (Number(skillRow._iDmgType) === 4 && stats[104] > stats[103]);
  const resolvedRow = Number(skillRow._iDmgType) === 4 ? { ...skillRow, _iDmgType: magic ? 2 : 1 } : skillRow;
  const ratios = Array.isArray(skillRow._kDamageParam1) ? skillRow._kDamageParam1 : [];
  const flats = Array.isArray(skillRow._kDamageParam2) ? skillRow._kDamageParam2 : [];
  let p1 = ratios.length > branch ? Number(ratios[branch]) : 10000;
  const p2 = flats.length > branch ? Number(flats[branch]) : 0;

  // Stat scaling in `_kDamageParamExtra`, named by `_kDamageFormulaExtra` and confirmed by the skill texts:
  //  T_AXadd0_etc[_withlimit] [1, bp, attr, (step), (limit)]  "Agility Resonance 0.1%": adds bp per step of attr (up to limit) to the ratio.
  //  AXaddBplus1[_withlimit]  [bp, attr, scale, (limit)]      "(1 + ASPD * 0.5%)": multiplies the damage.
  // With several tuples, tuple i belongs to damage branch i.
  let scale = 1;
  const formulas = asArray(skillRow._kDamageFormulaExtra);
  const extras = asArray(skillRow._kDamageParamExtra);
  extras.forEach((tuple, i) => {
    if (extras.length > 1 && i !== branch) return;
    const t = asArray(tuple).map(Number);
    const name = String(formulas[i] ?? '');
    const capped = name.endsWith('_withlimit');
    if (name.startsWith('T_AXadd0_etc') && t[0] === 1) {
      p1 += Math.floor(Math.min(stats[t[2]], capped ? t[t.length - 1] : Infinity) / (capped && t.length < 5 ? 1 : t[3] || 1)) * t[1];
    } else if (name.startsWith('AXaddBplus1')) {
      scale *= 1 + (Math.min(stats[t[1]], capped ? t[3] : Infinity) * t[0]) / t[2];
    }
  });

  // Bonus ATK / Bonus MATK (221 / 222, "an Extra attack that ignores DEF"; only the Collection cards give them) are added to the attack
  // like the server does (`CombatService.Effects`: new Fighter(P.ATK + 221, M.ATK + 222)). ponytail: the in-game text says the extra attack
  // ignores DEF, which the server's formula does not model either; the amounts are tiny (+16 of thousands).
  const atkStat = magic ? stats[104] + stats[222] : stats[103] + stats[221] + (model?.both ? stats[104] : 0);
  const rawSkillDmg = ((atkStat * p1) / 10000 + p2) * scale;

  const defStat = magic ? Number(defender.mdef || 0) : Number(defender.def || 0);
  // DEF cuts def / (def + 20 x a level). The emulator's server guesses that level is the defender's (`CombatService.Damage`, marked "inferred"); a
  // one-minute parse of a Lv 75 Ranger on the Lv 99 / DEF 1980 Dummy Challenge dummy says it is the attacker's: every skill without a bonus the model
  // lacks hit 0.84 +- 0.03 of the defender-level figure, and 1980 / (1980 + 20 x 75) takes 0.431 where 20 x 99 takes 0.5 (0.862). Equal for a same-level fight.
  // ponytail: one parse and one target, so the constant stays here: swap `attackerLevel` for `defender.level` to get the server's reading back.
  const attackerLevel = Math.max(1, Number(build.level || defender.level || 1));
  const defMitigation = 1 - defStat / (defStat + 20.0 * attackerLevel);

  const atkEle = Number(skillRow._iEleType) > 1 ? Number(skillRow._iEleType) : Number(build.element || 1);
  const defEle = Number(defender.element || 1);
  // Elemental Counter Ignore (235): "Increases damage dealt when your attack element is at a disadvantage". ponytail: read as cutting
  // that penalty by the percentage (the exported data names no formula).
  const ef = elementFactor(atkEle, defEle, data);
  const eleMod = Math.max(0.1, Math.min(10.0, 1 + (ef < 0 ? ef * Math.max(0, 1 - stats[235] / 10000) : ef) / 10000));

  const baseDamage = rawSkillDmg * defMitigation * eleMod;

  const attackerFighter = {
    atk: stats[103],
    matk: stats[104],
    hit: stats[109],
    cri: stats[111],
    level: build.level ?? 50,
    element: build.element ?? 1,
  };
  const hitRate = calcHitRate(attackerFighter, defender, skillRow);
  const critRate = calcCritRate(attackerFighter, defender, resolvedRow);

  // Post-hit adjusters: Bond (601), Totem execution (<30% HP), Totem OutgoingMultiplier, Totem ExtraDamage
  const bondBonusBp = Number(build.bondBonusBp || 0);
  const totemMultNormal = totemOutgoingMultiplier(build, resolvedRow, false, data, stats[101]);
  const totemMultCrit = isCritPossible(magic) ? totemOutgoingMultiplier(build, resolvedRow, true, data, stats[101]) : totemMultNormal;
  const ranged = Number(skillRow._iDistanceType || 1) === 2;
  // 215 "Damage Increase%" (Equipment Resonance) "affects the damage of the character's Damage Skills" like 211 / 213 / 227 / 229, so it
  // joins their bracket, and so do the card bonuses against the target's element, race and size (targetBonus, which the game's attribute
  // tips say "affect your damage against X monsters"). ponytail: the exported data does not give the game's bracket.
  // Skill-element bonuses (301-310) follow the resolved attack element, unlike bonuses against monster elements (321-330).
  const cardFx = cardEffects(build.cards, data);
  const size = Number(defender.size);
  const sizeProc = Number.isInteger(size) && size >= 1 && size <= 3 ? cardFx.sizeProc : null;
  const sizeProcChance = sizeProc ? sizeProc.chanceBp / 10000 : 0;
  const elementBonus = Number.isInteger(atkEle) && atkEle >= 1 && atkEle <= 10 ? stats[300 + atkEle] : 0;
  const extraSheetBonus = stats[215] + elementBonus + targetBonus(stats, defender, cardFx.sizeBonusBp, cardFx.ignoreSize)
    + (magic ? stats[213] : stats[211] + stats[ranged ? 229 : 227]);
  // 12xx are the buff layer of those damage bonuses (own pre-attributes, hidden from the panel): 1211 / 1213 Physical / Magic (True Sight,
  // Unlimited Shooting), 1215 all damage (pets' Esen's Execution), 1227 / 1229 melee / ranged Physical, 1250 / 1252 melee / ranged Magic.
  // ponytail: applied as a separate multiplier; the game's exact bracket is not in the exported data.
  const buffLayer = Math.max(0, 1 + (stats[1215] + (magic ? stats[1213] + stats[ranged ? 1252 : 1250] : stats[1211] + stats[ranged ? 1229 : 1227])) / 10000);

  const applyAdjusters = (dmgAfterFloatAndCrit, isCrit, targetHpRatio = 1.0, procBonusBp = 0) => {
    let amount = Math.max(1, Math.round(dmgAfterFloatAndCrit));
    if (bondBonusBp !== 0) {
      const prod = (amount * Math.max(0, 10000 + bondBonusBp)) / 10000;
      amount = Math.max(1, Math.floor(prod + 0.5));
    }
    if (targetHpRatio <= 0.30 && build.totemLowHpBonusBp > 0) {
      amount += Math.floor((amount * build.totemLowHpBonusBp) / 10000);
    }
    const totemMult = isCrit ? totemMultCrit : totemMultNormal;
    const bonus = extraSheetBonus + procBonusBp;
    const sheetMult =
      totemMult === 1 && (bonus !== 0 || (isCrit && stats[209] !== 0))
        ? Math.max(0, 1 + bonus / 10000) * (isCrit ? Math.max(0, (15000 + stats[209]) / 15000) : 1)
        : totemMult * (bonus !== 0 ? Math.max(0, 1 + bonus / 10000) : 1);
    amount = Math.floor(amount * sheetMult * buffLayer);
    return Math.max(1, amount);
  };

  const hpRatio = options.targetHpRatio ?? 1.0;
  const procBonusBp = sizeProc?.bonusBp ?? 0;
  const meanHit = (damage, crit) => {
    const plain = applyAdjusters(damage, crit, hpRatio);
    return sizeProcChance ? plain * (1 - sizeProcChance) + applyAdjusters(damage, crit, hpRatio, procBonusBp) * sizeProcChance : plain;
  };
  const normalHitMean = meanHit(baseDamage, false);
  const normalHitMin = applyAdjusters(baseDamage * 0.97, false, hpRatio, sizeProcChance === 1 ? procBonusBp : 0);
  const normalHitMax = applyAdjusters(baseDamage * 1.03, false, hpRatio, sizeProcChance > 0 ? procBonusBp : 0);
  const critHitMean = magic ? normalHitMean : meanHit(baseDamage * 1.5, true);
  const critHitMax = magic ? normalHitMax : applyAdjusters(baseDamage * 1.03 * 1.5, true, hpRatio, sizeProcChance > 0 ? procBonusBp : 0);

  const expectedPerAttempt =
    hitRate * ((1 - critRate) * normalHitMean + critRate * critHitMean);

  // A cast can land several instances (SKILL_MODEL.hits), each at its own branch: sum them for per-cast figures.
  let expectedPerCast = expectedPerAttempt;
  if (hitBranches.length > 1 && options.branch === undefined) {
    expectedPerCast = hitBranches.reduce((sum, b) => sum + (b === branch
      ? expectedPerAttempt
      : evaluateSkillDamage(build, defender, skillRow, { ...options, stats, rulesApplied: true, branch: b }, data).expectedPerAttempt), 0);
  }

  const timing = calcSkillTimingMs(stats, skillRow);
  return {
    // Exact damage for one rolled hit: base * float(0.97..1.03) [* 1.5 on a physical crit], then the same adjusters.
    damageAt: (floatRoll, isCrit, proc = sizeProcChance === 1) =>
      applyAdjusters(baseDamage * floatRoll * (isCrit && !magic ? 1.5 : 1), isCrit && !magic, hpRatio, proc && sizeProcChance > 0 ? procBonusBp : 0),
    skillId: skillRow._iID,
    skillName: skillRow.name || skillRow._kScriptLogic || `Skill ${skillRow._iID}`,
    magic,
    p1,
    p2,
    atkStat,
    defMitigation,
    eleMod,
    baseDamage,
    hitRate,
    critRate,
    sizeProcChance,
    normalHitMin,
    normalHitMean,
    normalHitMax,
    critHitMean,
    critHitMax,
    expectedPerAttempt,
    hitsPerCast: hitBranches.length,
    expectedPerCast,
    timing,
    instantDps: (expectedPerCast * 1000) / Math.max(1, timing.castLockMs),
  };
}

// ============================================================================
// 5. Multi-Second Skill Rotation & Auto-Attack Timeline Simulator
// ============================================================================

const GROUND_DOT_SCRIPTS = new Set([
  'Fire_Wall', 'Quagmire', 'Fire_Pillar', 'Meteor_Storm', 'Lord_of_Vermilion', 'Storm_Gust',
]);
const LOG_MS = 60000; // castLog covers the first minute

/**
 * Simulates a combat window (default 30,000 ms) with:
 * - Active skill priority list (casts highest-priority skill whose CD is ready)
 * - Auto-attack weaving whenever all priority skills are on CD
 * - Every cast locks the caster until its animation ends (`build.cancelBackswing`: until its interrupt frame); hits land at the
 *   client template's hit points (`castTimes`)
 * - Self-buff skills (`_kBuff1`) refreshing combat stats and dynamic skill parameters
 * - Multi-hit casts (`SKILL_MODEL.hits`), buff-triggered extra hits (`BUFF_PROCS`, e.g. Fear Breeze) and follow-up skills
 *   (`FOLLOW_UPS`, e.g. Warg Strike's hit on every Focused Arrow Strike once per 2.5 s; needs `build.skillLevels`)
 * - Periodic self-buffs (`PERIODIC_BUFFS`, e.g. the wolf's Warg Howl: +5% P.ATK for 10 s every 30 s) lifting the hits inside their windows
 * - Persistent ground DoT objects (`Fire_Wall`, `Storm_Gust`, etc.) ticking independently
 * - Totem on-cast floor stacks (`2500101`->`2500301`, `2500201`->`2500401`, etc.)
 * `castLog` lists every cast (start, lock, hit times) and trigger for timeline views.
 */
export function simulateRotation(build, defender, rotationSkillIds, durationMs = 30000, data = new Ro3DataStore(), trace = null) {
  const jobRow = data.row('JobConfig', build.career ?? 1100);
  const normalSkillId = build.normalAttackId ?? jobRow?._kSkillNormalID?.[0] ?? 1100001;
  const normalRow = data.row('SkillConfig', normalSkillId) ?? data.row('SkillConfig', 1000001);

  const activeBuffMap = new Map();
  const buffWindows = [];
  const setActiveBuff = (id, buff) => {
    const next = { startMs: 0, ...buff };
    const prev = activeBuffMap.get(id);
    if (prev) prev.expireMs = Math.min(prev.expireMs, next.startMs);
    activeBuffMap.set(id, next);
    buffWindows.push(next);
  };
  for (const b of build.activeBuffs ?? []) {
    const id = typeof b === 'object' ? b.id ?? b._iID : b;
    setActiveBuff(id, { id, expireMs: Infinity, piles: b.piles ?? 1, isTotemOwned: Boolean(b.isTotemOwned), sourceId: b.sourceId ?? 1 });
  }
  // A learned Season skill keeps its buff on you for the whole fight (SEASON_BUFFS); Gale Beat counts the trigger's casts instead.
  for (const [g, id] of Object.entries(SEASON_BUFFS)) {
    if (Number(build.skillLevels?.[g] ?? 0) > 0) setActiveBuff(id, { id, expireMs: Infinity, piles: 1, isTotemOwned: false, sourceId: 1 });
  }
  const galeOn = Number(build.skillLevels?.[GALE_BEAT.group] ?? 0) > 0;
  let galeStacks = 0;
  let cyclePtr = 0; // the game's auto-battle takes the next skill of its list after the one it cast

  const cdReadyAt = new Map();
  const groundObjects = [];
  const logEvents = [];
  const castLog = [];
  const nextFollowMs = new Map();
  const cancel = Boolean(build.cancelBackswing);
  // Timed buffs on you: the learned passives' periodic ones (the wolf's howl) and the pet lineup's (the Primary pet's cadence); each
  // is up while (t - firstMs) % periodMs < durMs. `build.timedBuffs` takes more ({ name, attrs: [[attribute, value]], periodMs, durMs }).
  const pet = petEffects(build.pets, data);
  const ownerHitEvents = [];
  const recordOwnerHit = (entry) => {
    if (pet.ownerHits.length) { entry.token = ownerHitEvents.length; ownerHitEvents.push(entry); }
    trace?.push(entry);
  };
  const periodic = [
    ...(build.periodicOff ? [] : Object.entries(PERIODIC_BUFFS)
      .filter(([group]) => Number(build.skillLevels?.[group] ?? 0) > 0)
      .map(([, p]) => ({ ...p, firstMs: Number(build.periodicStartMs ?? 0) }))),
    ...[...pet.timedBuffs, ...asArray(build.timedBuffs)].map((t, i) => ({ buff: 9e9 + i, firstMs: 0, ...t })),
  ];
  const periodicUp = (p, tMs) => tMs >= p.firstMs && (tMs - p.firstMs) % p.periodMs < p.durMs
    && (!p.afterHit || (tMs - p.firstMs) % p.periodMs > 0);
  let totalExpectedDamage = 0;
  let totalBurst5sDamage = 0;
  let casts = 0;
  let autoSwings = 0;
  let groundTicks = 0;

  let nowMs = 0;
  let nextAutoSwingMs = 0;
  // Totem combat passives: those of the deployed totems' skills plus the legacy single-id fields (profiles, tests).
  const totemFx = totemPassives(build, data);
  if (build.totemCastStackBuffId) {
    const cap = Math.max(1, Number(data.row('BuffConfig', build.totemCastStackBuffId)?._iMaxStack ?? 2)) + (build.totemExtraMaxStack ?? 0);
    totemFx.castStacks.push({ guid: 1, buffId: build.totemCastStackBuffId, durMs: 5000, cap });
  }
  if (build.totemExtraHitPassiveId) totemFx.extraHits.push({ guid: 1, passiveId: build.totemExtraHitPassiveId, magic: TOTEM_EXTRA_HIT[build.totemExtraHitPassiveId] ?? null });
  const nextTotemExtraProcMs = new Map(); // per (totem, passive), like TotemEffects.Proc's cooldown key
  const initStats = buildCharacterStats(build, data);
  let currentSp = build.currentSp ?? initStats[102];
  const energyLimit = build.energyLimit ?? 100;
  let currentEnergy = build.initialEnergy ?? energyLimit;
  const energyRecoverIntervalMs = build.energyRecoverIntervalMs ?? 0;
  const energyRecoverValue = build.energyRecoverValue ?? 0;
  let nextEnergyTickMs = energyRecoverIntervalMs > 0 ? energyRecoverIntervalMs : Infinity;

  // Helper to get live build snapshot with unexpired buffs + cached StatSheet
  const sheetByBuffSig = new Map();
  const currentBuildSnapshot = (tMs) => {
    let sig = '';
    const list = [];
    // Pet impacts are evaluated after the cast timeline is known. Reading a future timestamp must not erase earlier buff windows.
    for (const b of buffWindows) {
      if (b.startMs > tMs || b.expireMs <= tMs) continue;
      list.push(b);
      sig += `${b.id}:${b.piles},`;
    }
    for (const p of periodic) {
      if (!periodicUp(p, tMs)) continue;
      list.push({ id: p.buff, _kChangeAttri: p.attrs, expireMs: Infinity, piles: 1, isTotemOwned: false, sourceId: 0 });
      sig += `${p.buff}:1,`;
    }
    let cached = sheetByBuffSig.get(sig);
    if (!cached) {
      const snapBuild = { ...build, activeBuffs: list };
      cached = { snapBuild, stats: buildCharacterStats(snapBuild, data) };
      sheetByBuffSig.set(sig, cached);
    }
    return cached;
  };

  // Advance ground objects up to targetTimeMs
  const tickGroundObjectsUpTo = (limitMs) => {
    for (const obj of groundObjects) {
      while (obj.nextTickMs <= limitMs && obj.nextTickMs < obj.expiresMs && obj.nextTickMs <= durationMs) {
        const { snapBuild, stats } = currentBuildSnapshot(obj.nextTickMs);
        const evalRes = evaluateSkillDamage(snapBuild, defender, obj.skillRow, { stats, rulesApplied: true }, data);
        totalExpectedDamage += evalRes.expectedPerAttempt;
        recordOwnerHit({ t: obj.nextTickMs, kind: 'dot', ev: evalRes, proc: null });
        if (obj.nextTickMs <= 5000) totalBurst5sDamage += evalRes.expectedPerAttempt;
        groundTicks++;
        obj.nextTickMs += obj.intervalMs;
      }
    }
  };

  while (nowMs < durationMs) {
    while (nowMs >= nextEnergyTickMs) {
      currentEnergy = Math.min(energyLimit, currentEnergy + energyRecoverValue);
      nextEnergyTickMs += energyRecoverIntervalMs;
    }
    const { snapBuild: snap, stats } = currentBuildSnapshot(nowMs);

    // Helper to check & compute skill SP and Energy cost (_kCost types 1, 7, 8)
    const getSkillCost = (r) => {
      let spCost = 0;
      let energyCost = 0;
      for (const c of asArray(r._kCost)) {
        if (!Array.isArray(c) || c.length < 3) continue;
        if (c[0] === 1 && c.length >= 4 && Number(c[1]) === 2001) {
          spCost += Math.max(0, Number(c[3]) + Math.trunc((stats[102] * Number(c[2])) / 10000));
        } else if (c[0] === 7 && c.length >= 4 && Number(c[1]) === 2001) {
          spCost += Math.max(0, Math.trunc((stats[Number(c[2])] * Number(c[3])) / 10000));
        } else if (c[0] === 8 && c.length >= 4) {
          const pct = Math.ceil((energyLimit * Number(c[2])) / 10000);
          energyCost += Math.max(pct, Number(c[3]));
        }
      }
      return { spCost, energyCost };
    };

    // Pick the skill to cast: the first ready one of the priority list, or (build.rotationCycle, the game's auto-battle) the first ready one
    // from the skill after the last cast, so a skill with no cooldown does not starve the ones behind it.
    let chosenRow = null;
    let chosenCost = { spCost: 0, energyCost: 0 };
    let chosenAt = -1;
    let isAuto = false;
    const listLen = rotationSkillIds.length;
    for (let k = 0; k < listLen; k++) {
      const at = build.rotationCycle ? (cyclePtr + k) % listLen : k;
      const sid = rotationSkillIds[at];
      const r = data.row('SkillConfig', sid);
      if (!r || Number(r._iBasicType) !== 1) continue;
      const group = Number(r._iSkillID || sid);
      if ((cdReadyAt.get(group) ?? 0) > nowMs) continue;
      if (build.ridden === false && MOUNTED_ONLY.has(group)) continue;
      const cost = getSkillCost(r);
      if ((build.enforceSpCost && currentSp < cost.spCost) || currentEnergy < cost.energyCost) continue;
      // If it's a pure buff skill (_kDamageParam1 empty), only cast if buff is not already active
      const hasDmg = Array.isArray(r._kDamageParam1) && r._kDamageParam1.length > 0;
      const buff1 = Array.isArray(r._kBuff1) && r._kBuff1.length > 0 ? r._kBuff1[0][0] : 0;
      if (!hasDmg && buff1 && activeBuffMap.has(buff1) && activeBuffMap.get(buff1).expireMs > nowMs + 1000) {
        continue;
      }
      chosenRow = r;
      chosenCost = cost;
      chosenAt = at;
      break;
    }
    if (build.rotationCycle && chosenAt >= 0) cyclePtr = (chosenAt + 1) % listLen;

    if (!chosenRow) {
      if (nowMs < nextAutoSwingMs) {
        const earliestSkillReady = rotationSkillIds
          .map((sid) => cdReadyAt.get(Number(data.row('SkillConfig', sid)?._iSkillID || sid)) ?? Infinity)
          .reduce((a, b) => Math.min(a, b), Infinity);
        const jumpTo = Math.min(nextAutoSwingMs, earliestSkillReady, durationMs);
        if (jumpTo > nowMs) {
          tickGroundObjectsUpTo(jumpTo);
          nowMs = jumpTo;
          continue;
        }
      }
      chosenRow = normalRow;
      isAuto = true;
    }

    // King of the Wargs: while its buff lasts, Warg Hunt is cast in its Enhanced skill mode.
    const kingBuff = (tMs) => [...buffWindows].reverse().find((b) => Math.floor(Number(b.id) / 100) === KING_OF_THE_PACK.family && b.startMs <= tMs && b.expireMs > tMs);
    const enhanced = isAuto || !kingBuff(nowMs) ? undefined : KING_OF_THE_PACK.enhance[Number(chosenRow._iSkillID)];
    let castRow = enhanced === undefined ? chosenRow : data.row('SkillConfig', Number(chosenRow._iSkillID) * 100 + enhanced * 10 + Number(chosenRow._iLevel)) ?? chosenRow;
    if (!isAuto && enhanced === undefined) {
      // Season skills (SEASON_BUFFS): a buff can put the skill in another mode, and Gale Beat's fifth cast is the enhanced skill.
      const base = Number(chosenRow._iSkillID);
      const lv = Number(chosenRow._iLevel);
      const mode = SEASON_MODE_GROUPS.has(base) ? skillMode(base, snap.activeBuffs, data) : 0;
      const gale = galeOn && base === GALE_BEAT.trigger;
      const sent = gale && galeStacks >= GALE_BEAT.casts ? data.row('SkillConfig', GALE_BEAT.enhanced[mode === 4 ? 1 : 0] * 100 + lv) : null;
      if (gale) galeStacks = sent ? 0 : Math.min(GALE_BEAT.casts, galeStacks + 1);
      castRow = sent ?? (mode > 0 ? data.row('SkillConfig', base * 100 + mode * 10 + lv) : null) ?? castRow;
    }
    const effectiveRow = applySkillParameterRules(castRow, snap.activeBuffs, data);
    const timing = calcSkillTimingMs(stats, effectiveRow);
    const group = Number(effectiveRow._iSkillID || effectiveRow._iID);
    if (timing.cdMs > 0) cdReadyAt.set(group, nowMs + timing.cdMs);
    for (const g of COOLDOWN_RESETS[group] ?? []) cdReadyAt.delete(g);
    currentSp = Math.max(0, currentSp - chosenCost.spCost);
    currentEnergy = Math.max(0, currentEnergy - chosenCost.energyCost);

    // Hits land at the client template's hit points (CombatService.ImpactOffset); the cast locks the caster until its animation ends.
    const hitBranches = hitsOf(effectiveRow);
    const { hitAt, fullMs, lockMs } = castTimes(data, effectiveRow, timing, hitBranches.length, cancel);
    const impactMs = nowMs + hitAt[0];
    tickGroundObjectsUpTo(Math.min(impactMs, durationMs));
    if (nowMs < LOG_MS) castLog.push({ t: nowMs, kind: isAuto ? 'auto' : 'cast', id: effectiveRow._iID, name: effectiveRow.name || effectiveRow._kScriptLogic, lockMs, fullMs, hits: hitAt.map((x) => nowMs + x) });

    if (impactMs <= durationMs) {
      // Totem on-cast stacks (CastLanded), per source totem
      for (const { guid, buffId: bId, durMs, cap } of totemFx.castStacks) {
        const key = `totem:${guid}:${bId}`;
        const prev = activeBuffMap.get(key);
        setActiveBuff(key, {
          id: bId,
          startMs: impactMs,
          expireMs: impactMs + durMs,
          piles: Math.min(cap, (prev?.expireMs > impactMs ? prev.piles : 0) + 1),
          isTotemOwned: true,
          sourceId: guid,
        });
      }

      // Apply _kBuff1 self-buffs (Warg Charge's 10% Physical DMG needs the wolf ridden)
      if (Array.isArray(effectiveRow._kBuff1) && !(build.ridden === false && RIDING_BUFF_ONLY.has(group))) {
        for (const tuple of effectiveRow._kBuff1) {
          if (Array.isArray(tuple) && tuple.length >= 3 && tuple[0] > 0 && tuple[1] > 0) {
            const bId = Number(tuple[0]);
            const dur = Number(tuple[2]) > 0 ? Number(tuple[2]) : 60000;
            setActiveBuff(bId, { id: bId, startMs: impactMs, expireMs: impactMs + dur, piles: 1, isTotemOwned: false, sourceId: 0 });
          }
        }
      }

      const script = effectiveRow._kScriptLogic || '';
      const logic = Array.isArray(effectiveRow._kLogicData) ? effectiveRow._kLogicData : [];
      if (GROUND_DOT_SCRIPTS.has(script) && logic.length >= 3) {
        const intervalMs = Math.max(50, Number(logic[1]));
        const objDurMs = Math.max(1, Number(logic[2]));
        groundObjects.push({
          skillRow: effectiveRow,
          intervalMs,
          nextTickMs: impactMs,
          expiresMs: impactMs + objDurMs,
        });
        tickGroundObjectsUpTo(impactMs);
      } else if (Array.isArray(effectiveRow._kDamageParam1) && effectiveRow._kDamageParam1.length > 0) {
        // One cast can land several instances (SKILL_MODEL.hits), each at its template hit point.
        const skillTags = asArray(effectiveRow._kSkilltag);
        for (let h = 0; h < hitBranches.length; h++) {
          const hitMs = nowMs + hitAt[h];
          if (hitMs > durationMs) break;
          const { snapBuild: impactSnap, stats: impactStats } = currentBuildSnapshot(hitMs);
          const evalRes = evaluateSkillDamage(impactSnap, defender, effectiveRow, { stats: impactStats, rulesApplied: true, branch: hitBranches[h] }, data);
          let hitDmg = evalRes.expectedPerAttempt;
          let procEvent = null;
          // Totem ExtraHitDamage passive procs (2504001/2514001 magic, 2515701/2507501 physical: chance, 110% ATK/MATK, CD per totem)
          if (h === 0) for (const { guid, passiveId, magic } of totemFx.extraHits) {
            const key = `${guid}:${passiveId}`;
            if ((magic !== null && magic !== evalRes.magic) || hitMs < (nextTotemExtraProcMs.get(key) ?? 0)) continue;
            const pRow = data.row('BuffConfig', passiveId);
            const chanceBp = Number(pRow?._kLogicData?.[0] ?? 1500);
            const coeff = Number(pRow?._kDescData?.[1] ?? 110);
            const cdSec = Number(pRow?._kDescData?.[2] ?? 5);
            const extraHit = Math.floor(((evalRes.magic ? impactStats[104] : impactStats[103]) * coeff) / 100);
            const pProc = evalRes.hitRate * (chanceBp / 10000);
            hitDmg += pProc * extraHit;
            (procEvent ??= []).push({ p: pProc, dmg: extraHit });
            // Expected cooldown advancement under Bernoulli proc trials
            nextTotemExtraProcMs.set(key, hitMs + Math.round(pProc * cdSec * 1000));
          }
          totalExpectedDamage += hitDmg;
          if (hitMs <= 5000) totalBurst5sDamage += hitDmg;
          recordOwnerHit({ t: hitMs, kind: isAuto ? 'auto' : 'skill', ev: evalRes, proc: procEvent });
          // Buff-triggered extra hits (BUFF_PROCS): an expected-value event that happens with probability prob. Only the targeted instance
          // counts: the extra instances of a cast (a later branch: Focused Arrow Strike's 15% area hit) do not trigger it again.
          if (!(hitBranches[h] > 0)) for (const b of impactSnap.activeBuffs ?? []) {
            const rule = BUFF_PROCS[Math.floor(Number(b.id) / 100)];
            const bRow = rule && skillTags.includes(rule.tag) ? data.row('BuffConfig', b.id) : null;
            const chance = Number(bRow?._kLogicData?.[0] ?? 0) / 10000;
            if (!(chance > 0)) continue;
            const procRes = evaluateSkillDamage(impactSnap, defender, buffProcRow(bRow, rule), { stats: impactStats, rulesApplied: true }, data);
            const prob = evalRes.hitRate * chance;
            totalExpectedDamage += prob * procRes.expectedPerAttempt;
            if (hitMs <= 5000) totalBurst5sDamage += prob * procRes.expectedPerAttempt;
            trace?.push({ t: hitMs, kind: 'skill', ev: procRes, proc: null, prob });
            if (hitMs < LOG_MS) castLog.push({ t: hitMs, kind: 'proc', name: rule.name, prob, hits: [hitMs], lockMs: 0 });
          }
          if (h > 0) continue;
          // Energy recovery on hit (_kHitRecoverEnergy: [energyId, amount])
          if (Array.isArray(effectiveRow._kHitRecoverEnergy) && effectiveRow._kHitRecoverEnergy.length >= 2) {
            const eAmount = Number(effectiveRow._kHitRecoverEnergy[1] || 0);
            currentEnergy = Math.min(energyLimit, currentEnergy + eAmount);
          }
          if (logEvents.length < 12) {
            logEvents.push({
              timeMs: hitMs,
              skill: evalRes.skillName,
              expectedDmg: Math.round(hitDmg),
            });
          }
        }
      }
      // Extra skill rows cast along with this cast: a follow-up (FOLLOW_UPS) and King of the Wargs' wolf followers. Each damage instance
      // lands at its own template point and reads the buffs up at that moment.
      const landExtra = (xRow, label, kind) => {
        const fRow = applySkillParameterRules({ ...xRow, name: label }, snap.activeBuffs, data);
        const branches = hitsOf(fRow);
        const times = castTimes(data, fRow, calcSkillTimingMs(stats, fRow), branches.length).hitAt.map((x) => nowMs + x).filter((x) => x <= durationMs);
        times.forEach((fHitMs, i) => {
          const { snapBuild: fSnap, stats: fStats } = currentBuildSnapshot(fHitMs);
          const fRes = evaluateSkillDamage(fSnap, defender, fRow, { stats: fStats, rulesApplied: true, branch: branches[i] }, data);
          totalExpectedDamage += fRes.expectedPerAttempt;
          if (fHitMs <= 5000) totalBurst5sDamage += fRes.expectedPerAttempt;
          recordOwnerHit({ t: fHitMs, kind: 'skill', ev: fRes, proc: null });
        });
        if (times.length && times[0] < LOG_MS) castLog.push({ t: times[0], kind, name: fRow.name, hits: times, lockMs: 0 });
      };
      // Follow-up skills (FOLLOW_UPS): a cast of the trigger skill sends the follow-up row once per ICD, landing at its own hit point.
      // Gale Beat's enhanced cast is a Focused Arrow Strike for this too.
      const followGroup = GALE_BEAT.enhanced.includes(group) ? GALE_BEAT.trigger : group;
      const follow = FOLLOW_UPS[followGroup];
      const followLv = follow ? Number(build.skillLevels?.[follow.group] ?? 0) : 0;
      const followRow = followLv > 0 ? data.row('SkillConfig', follow.group * 100 + follow.mode * 10 + followLv) : null;
      if (followRow && nowMs >= (nextFollowMs.get(followGroup) ?? 0)) {
        nextFollowMs.set(followGroup, nowMs + follow.icdMs);
        landExtra(followRow, `${followRow.name || followRow._kScriptLogic} (follow-up)`, 'follow');
      }
      // King of the Wargs (a rider's casts only): Warg Charge and Warg Bite also send the wolf followers, at the level of the buff.
      const king = kingBuff(nowMs);
      const extraGroup = !isAuto && king ? KING_OF_THE_PACK.extras[group] : 0;
      const extraRow = extraGroup ? data.row('SkillConfig', extraGroup * 100 + (Number(king.id) % 100)) : null;
      if (extraRow) landExtra(extraRow, extraRow.name || extraRow._kScriptLogic, 'follow');
      if (isAuto) autoSwings++;
      else casts++;
    }

    const castEndMs = nowMs + lockMs;
    if (isAuto) nextAutoSwingMs = castEndMs;
    else nextAutoSwingMs = Math.max(nextAutoSwingMs, castEndMs);
    tickGroundObjectsUpTo(Math.min(castEndMs, durationMs));
    nowMs = castEndMs;
  }

  const petHitAt = pet.hits.flatMap((h) => {
    const ts = [];
    for (let cast = 0; cast * h.periodMs < durationMs; cast++) {
      const t = h.firstMs + cast * h.periodMs;
      if (t <= durationMs) ts.push({ t, h, cast });
    }
    return ts;
  }).sort((a, b) => a.t - b.t || Number(Boolean(a.h.sharePct)) - Number(Boolean(b.h.sharePct)));
  const primaryTotals = new Map();
  const primaryHitsByToken = new Map();
  for (const { t, h, cast } of petHitAt) {
    const token = h.primary ? `pet:${cast}:${h.primaryIndex}` : undefined;
    const requiresHit = h.requiresPrimary !== undefined ? `pet:${cast}:${h.requiresPrimary}` : undefined;
    const prob = requiresHit === undefined ? 1 : primaryHitsByToken.get(requiresHit).hitRate;
    let res;
    if (h.sharePct) {
      const source = primaryTotals.get(cast);
      if (!source) continue;
      const scale = (v) => Math.round(v * h.sharePct);
      res = {
        skillId: h.id, skillName: h.name, magic: false, hitRate: 1, critRate: 0,
        expectedPerAttempt: scale(source.mean),
        damageAt: (roll) => scale(roll < 1 ? source.lo : roll > 1 ? source.hi : source.mean),
      };
    } else {
      const { snapBuild, stats } = currentBuildSnapshot(t);
      res = evaluateSkillDamage({ ...snapBuild, element: 1 }, defender, h.row, { stats, rulesApplied: true }, data);
    }
    if (h.primary) {
      primaryHitsByToken.set(token, res);
      const sum = primaryTotals.get(cast) ?? { mean: 0, lo: 0, hi: 0 };
      sum.mean += res.expectedPerAttempt; sum.lo += res.normalHitMin; sum.hi += res.critRate > 0 ? res.critHitMax : res.normalHitMax;
      primaryTotals.set(cast, sum);
    }
    totalExpectedDamage += prob * res.expectedPerAttempt;
    if (t <= 5000) totalBurst5sDamage += prob * res.expectedPerAttempt;
    trace?.push({ t, kind: 'pet', ev: res, proc: null, prob, token, requiresHit, ...(h.primary ? { primaryCast: cast } : {}), ...(h.sharePct ? { shareCast: cast, sharePct: h.sharePct } : {}) });
    if (!h.primary && t < LOG_MS) castLog.push({ t, kind: 'proc', name: h.name, prob, hits: [t], lockMs: 0 });
  }
  for (const c of pet.casts) for (let t = c.firstMs; t < Math.min(durationMs, LOG_MS); t += c.periodMs) {
    castLog.push({ t, kind: 'pet', id: c.id, name: c.name, lockMs: 0, hits: c.hits.map((h) => t + h).filter((h) => h <= durationMs) });
  }
  // Owner-hit windows (e.g. Dullahan) see only real owner attacks, never damage from another pet proc.
  ownerHitEvents.sort((a, b) => a.t - b.t);
  for (const h of pet.ownerHits) {
    const recent = [];
    for (const e of ownerHitEvents) {
      if (!periodicUp(h, e.t)) continue;
      while (recent.length && recent[0].t + h.icdMs <= e.t) recent.shift();
      const prob = e.ev.hitRate * Math.max(0, 1 - recent.reduce((sum, p) => sum + p.prob, 0));
      recent.push({ t: e.t, prob });
      const { snapBuild, stats } = currentBuildSnapshot(e.t);
      const res = evaluateSkillDamage({ ...snapBuild, element: 1 }, defender, h.row, { stats, rulesApplied: true }, data);
      totalExpectedDamage += prob * res.expectedPerAttempt;
      if (e.t <= 5000) totalBurst5sDamage += prob * res.expectedPerAttempt;
      trace?.push({ t: e.t, kind: 'pet', ev: res, proc: null, prob, requiresHit: e.token, icdKey: h.row._iID, icdMs: h.icdMs });
      if (prob > 0 && e.t < LOG_MS) castLog.push({ t: e.t, kind: 'proc', name: h.name, prob, hits: [e.t], lockMs: 0 });
    }
  }

  // The windows of the periodic buffs, for the cast log (clipped to the fight and to the first minute).
  for (const p of periodic) {
    const attrs = p.attrs ?? asPairs(data.row('BuffConfig', p.buff)?._kChangeAttri);
    for (let t = p.firstMs; t < Math.min(durationMs, LOG_MS); t += Math.max(1, p.periodMs)) {
      const from = Math.max(0, t);
      const durMs = Math.min(t + p.durMs, durationMs) - from;
      if (durMs > 0) castLog.push({ t: from, kind: 'buff', name: p.name, durMs, attrs, hits: [], lockMs: 0 });
    }
  }

  return {
    durationMs,
    totalExpectedDamage,
    sustainedDps: (totalExpectedDamage * 1000) / durationMs,
    burst5sDps: (totalBurst5sDamage * 1000) / Math.min(5000, durationMs),
    casts,
    autoSwings,
    groundTicks,
    sampleTimeline: logEvents,
    castLog,
  };
}

// ============================================================================
// 6. Maximum-Damage Stat Allocation & Build/Affix Optimizer
// ============================================================================

/**
 * Solves for the exact stat allocation [STR, AGI, VIT, INT, DEX, LUK] in [1..99]^6
 * subject to sum(StatCost(s_i)) <= budget that maximizes the objective (burst or sustained DPS).
 *
 * Uses a hybrid solver:
 * 1. Exact 2D/3D grid sweep over the primary offensive stats for the job/skill family
 * 2. Multi-step coordinate ascent + pairwise 2-opt stat swaps across all 6 stats to handle
 *    stepped ceiling thresholds (`Math.ceil` in `StatCalculator`) and non-linear `StatCost` tiers.
 *
 * ponytail: 6D exhaustive search over 99^6 (~9.4e11 states) is pruned to active offensive axes +
 * multi-step coordinate ascent/2-opt; if a custom stunt ever couples all 6 stats non-monotonically,
 * upgrade to meet-in-the-middle pareto frontier DP over cost budgets [0..budget].
 */
export function optimizeStatAllocation(build, defender, options = {}, data = new Ro3DataStore()) {
  const level = build.level ?? 50;
  const budget = options.budget ?? totalStatPoints(level, build.bonusStatPoints ?? 0, data);
  const mode = options.mode ?? 'sustained'; // 'sustained' | 'burst'
  const rotation = options.rotation ?? [1100210, 1100110];
  const primarySkillRow = data.row('SkillConfig', rotation[0]) ?? data.row('SkillConfig', 1100110);

  const costTable = new Int32Array(MAX_STAT + 1);
  for (let v = 1; v <= MAX_STAT; v++) costTable[v] = statCost(v, data);

  const evalCache = new Map();
  const scoreStats = (stats6) => {
    const key = stats6.join(',');
    if (evalCache.has(key)) return evalCache.get(key);
    const candidateBuild = { ...build, stats: stats6 };
    let val;
    if (mode === 'burst') {
      val = evaluateSkillDamage(candidateBuild, defender, primarySkillRow, {}, data).expectedPerAttempt;
    } else {
      val = simulateRotation(candidateBuild, defender, rotation, options.windowMs ?? 20000, data).sustainedDps;
    }
    evalCache.set(key, val);
    return val;
  };

  let bestStats = [1, 1, 1, 1, 1, 1];
  let bestScore = scoreStats(bestStats);

  // Stage 1: Exact 2D grid sweep over top candidate pairs (STR/DEX/INT + LUK/AGI/DEX)
  const jobRow = data.row('JobConfig', build.career ?? 1100);
  const isRanged = jobRow && Number(jobRow._iDistanceType) === 2;
  const isMagic = Number(primarySkillRow?._iDmgType) === 2;
  const primaryIdx = isMagic ? 3 : isRanged ? 4 : 0; // INT(3), DEX(4), or STR(0)
  const secondaryIndices = isMagic ? [4, 1] : isRanged ? [5, 1] : [5, 4, 1];

  for (const secIdx of secondaryIndices) {
    for (let pVal = 1; pVal <= MAX_STAT; pVal += (pVal < 80 ? 4 : 1)) {
      const rem1 = budget - costTable[pVal];
      if (rem1 < 0) break;
      for (let sVal = 1; sVal <= MAX_STAT; sVal += (sVal < 60 ? 6 : 2)) {
        const rem2 = rem1 - costTable[sVal];
        if (rem2 < 0) break;
        const thirdIdx = [5, 1, 4].find((idx) => idx !== primaryIdx && idx !== secIdx) ?? 2;
        let tVal = 1;
        while (tVal < MAX_STAT && costTable[tVal + 1] <= rem2) tVal++;
        const cand = [1, 1, 1, 1, 1, 1];
        cand[primaryIdx] = pVal;
        cand[secIdx] = sVal;
        cand[thirdIdx] = tVal;
        const sc = scoreStats(cand);
        if (sc > bestScore) {
          bestScore = sc;
          bestStats = cand;
        }
      }
    }
  }

  // Stage 2: Multi-step coordinate ascent & pairwise 2-opt swaps over all 6 stats
  let improved = true;
  let iter = 0;
  while (improved && ++iter <= 15) {
    improved = false;
    const currentUsed = bestStats.reduce((a, v) => a + costTable[v], 0);
    const free = budget - currentUsed;

    // Try single-stat increments of +1..+5 within budget
    for (let i = 0; i < 6; i++) {
      for (let step = 1; step <= 5; step++) {
        if (bestStats[i] + step > MAX_STAT) break;
        const deltaCost = costTable[bestStats[i] + step] - costTable[bestStats[i]];
        if (deltaCost <= free) {
          const next = [...bestStats];
          next[i] += step;
          const sc = scoreStats(next);
          if (sc > bestScore + 1e-9) {
            bestScore = sc;
            bestStats = next;
            improved = true;
          }
        }
      }
    }

    // Try pairwise transfers: reduce stat i by 1..4, increase stat j as much as budget allows
    for (let i = 0; i < 6; i++) {
      if (bestStats[i] <= 1) continue;
      for (let drop = 1; drop <= Math.min(4, bestStats[i] - 1); drop++) {
        const baseCand = [...bestStats];
        baseCand[i] -= drop;
        const avail = budget - baseCand.reduce((a, v) => a + costTable[v], 0);
        for (let j = 0; j < 6; j++) {
          if (i === j || baseCand[j] >= MAX_STAT) continue;
          let targetJ = baseCand[j];
          while (targetJ < MAX_STAT && costTable[targetJ + 1] - costTable[baseCand[j]] <= avail) {
            targetJ++;
          }
          if (targetJ > baseCand[j]) {
            const next = [...baseCand];
            next[j] = targetJ;
            const sc = scoreStats(next);
            if (sc > bestScore + 1e-9) {
              bestScore = sc;
              bestStats = next;
              improved = true;
            }
          }
        }
      }
    }
  }

  const used = bestStats.reduce((a, v) => a + costTable[v], 0);
  const finalBuild = { ...build, stats: bestStats };
  return {
    budget,
    usedPoints: used,
    unspentPoints: budget - used,
    optimalStats: {
      STR: bestStats[0],
      AGI: bestStats[1],
      VIT: bestStats[2],
      INT: bestStats[3],
      DEX: bestStats[4],
      LUK: bestStats[5],
      raw: bestStats,
    },
    optimalScore: bestScore,
    statSheet: buildCharacterStats(finalBuild, data),
    rotationSimulation: simulateRotation(finalBuild, defender, rotation, options.windowMs ?? 20000, data),
  };
}

/**
 * The best split of the stat points between two stats: `pair` holds two 0-based indexes into [STR, AGI, VIT, INT, DEX, LUK], every other
 * stat stays at 1, and for each value of the first stat the second takes everything the budget still buys (up to 99). Scored like
 * `optimizeStatAllocation` (sustained DPS of `options.rotation`). ponytail: the sweep takes the first stat in steps of 4 and then every
 * value around the best step, so it assumes one DPS peak along the split.
 */
export function optimizeStatSplit(build, defender, pair, options = {}, data = new Ro3DataStore()) {
  const budget = options.budget ?? totalStatPoints(build.level ?? 50, build.bonusStatPoints ?? 0, data);
  const rotation = options.rotation ?? [];
  const cost = new Int32Array(MAX_STAT + 1);
  for (let v = 1; v <= MAX_STAT; v++) cost[v] = statCost(v, data);
  const [a, b] = pair;
  const splitAt = (va) => {
    if (cost[va] > budget) return null;
    let vb = 1;
    while (vb < MAX_STAT && cost[va] + cost[vb + 1] <= budget) vb++;
    const stats = [1, 1, 1, 1, 1, 1];
    stats[a] = va;
    stats[b] = vb;
    return stats;
  };
  const scores = new Map();
  const score = (va) => {
    if (!scores.has(va)) {
      const stats = splitAt(va);
      scores.set(va, stats ? simulateRotation({ ...build, stats }, defender, rotation, options.windowMs ?? 20000, data).sustainedDps : -Infinity);
    }
    return scores.get(va);
  };
  let best = 1;
  for (let va = 1; va <= MAX_STAT; va += 4) if (score(va) > score(best)) best = va;
  for (let va = Math.max(1, best - 3); va <= Math.min(MAX_STAT, best + 3); va++) if (score(va) > score(best)) best = va;
  const stats = splitAt(best);
  return { stats, dps: score(best), used: usedStatPoints(stats, data), budget };
}

/**
 * Evaluates candidate skill rotations and computes marginal affix weights at the optimal stat build.
 */
export function optimizeRotationAndAffixes(build, defender, candidateRotations, data = new Ro3DataStore()) {
  const rotationResults = candidateRotations.map((rot) => {
    const sim = simulateRotation(build, defender, rot.skills, 20000, data);
    return {
      name: rot.name,
      skills: rot.skills,
      sustainedDps: sim.sustainedDps,
      burst5sDps: sim.burst5sDps,
      casts: sim.casts,
      autoSwings: sim.autoSwings,
      groundTicks: sim.groundTicks,
    };
  });
  rotationResults.sort((a, b) => b.sustainedDps - a.sustainedDps);
  const bestRotation = rotationResults[0];

  const baseDps = bestRotation.sustainedDps;
  const probes = [
    { label: '+1 STR (Attr 1)', attr: [1, 1], powerCost: 50 },
    { label: '+1 AGI (Attr 2)', attr: [2, 1], powerCost: 50 },
    { label: '+1 INT (Attr 4)', attr: [4, 1], powerCost: 50 },
    { label: '+1 DEX (Attr 5)', attr: [5, 1], powerCost: 50 },
    { label: '+1 LUK (Attr 6)', attr: [6, 1], powerCost: 50 },
    { label: '+10 P.ATK (Attr 103)', attr: [103, 10], powerCost: 50 },
    { label: '+10 M.ATK (Attr 104)', attr: [104, 10], powerCost: 50 },
    { label: '+1% P.ATK (Attr 1031 = 100)', attr: [1031, 100], powerCost: 200 },
    { label: '+1% M.ATK (Attr 1041 = 100)', attr: [1041, 100], powerCost: 200 },
    { label: '+1% CRIT Rate (Attr 111 = 100)', attr: [111, 100], powerCost: 100 },
    { label: '+1% Crit DMG (Attr 209 = 100)', attr: [209, 100], powerCost: 100 },
    { label: '+1% P.DMG Bonus (Attr 211 = 100)', attr: [211, 100], powerCost: 200 },
    { label: '+1% M.DMG Bonus (Attr 213 = 100)', attr: [213, 100], powerCost: 200 },
  ];

  const affixWeights = probes.map((p) => {
    const modBuild = {
      ...build,
      affixAttrs: [...(build.affixAttrs ?? []), p.attr],
    };
    const newDps = simulateRotation(modBuild, defender, bestRotation.skills, 20000, data).sustainedDps;
    const deltaDps = newDps - baseDps;
    const pctGain = baseDps > 0 ? (deltaDps / baseDps) * 100 : 0;
    return {
      label: p.label,
      deltaDps,
      pctGain,
      dpsPer100Power: p.powerCost > 0 ? (deltaDps / p.powerCost) * 100 : 0,
    };
  });
  affixWeights.sort((a, b) => b.deltaDps - a.deltaDps);

  return { rotationResults, bestRotation, affixWeights };
}

// ============================================================================
// 6b. Monte Carlo Damage Distribution (`CombatService.Damage` rolls replayed over the simulated rotation)
// ============================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs `simulateRotation` once to collect its timed damage events, then replays them `options.runs` times with the
 * server's rolls: a miss when rand >= hitRate (no roll when the skill never misses), damage float uniform
 * [0.97, 1.03), physical crit when rand < critRate (x1.5).
 * Returns per-run totals, per-bucket cumulative damage (runs x (nBuckets + 1)), per-skill aggregates and per-hit histograms.
 * `captureRun` also retains the first run's actual rolled hits for visual playback without consuming additional randomness.
 *
 * ponytail: the cast timeline stays deterministic (exactly as in simulateRotation); only damage rolls are random, and
 * the totem extra-hit passive is a Bernoulli(p) per eligible event instead of simulating its cooldown. A buff-triggered
 * hit (trace event with `prob`) is drawn once per run, independent of the hit that triggers it.
 */
export function simulateDistribution(build, defender, rotationSkillIds, durationMs = 30000, options = {}, data = new Ro3DataStore()) {
  const bucketMs = options.bucketMs ?? 1000;
  const bins = options.bins ?? 48;
  const rng = mulberry32(options.seed ?? 1);
  const trace = [];
  const deterministic = simulateRotation(build, defender, rotationSkillIds, durationMs, data, trace);
  trace.sort((a, b) => a.t - b.t);
  // Cap runs x events so a long window of fast skills cannot freeze the page.
  const runs = Math.max(1, Math.min(Math.trunc(options.runs ?? 2000), Math.max(200, Math.floor(4e7 / Math.max(1, trace.length)))));
  const nBuckets = Math.max(1, Math.ceil(durationMs / bucketMs));

  const skills = [];
  const byId = new Map();
  const events = trace.map((e) => {
    let sk = byId.get(e.ev.skillId);
    if (!sk) {
      sk = {
        id: e.ev.skillId,
        name: e.ev.skillName,
        kind: e.kind === 'auto' ? 'auto' : e.kind === 'pet' ? 'pet' : 'skill',
        magic: e.ev.magic,
        events: 0,
        total: 0,
        hits: 0,
        crits: 0,
        misses: 0,
        lo: Infinity,
        hi: -Infinity,
        perBucket: new Float64Array(nBuckets),
        normalBins: null,
        critBins: null,
      };
      byId.set(sk.id, sk);
      skills.push(sk);
    }
    sk.magic &&= e.ev.magic;
    sk.events += e.prob ?? 1;
    sk.lo = Math.min(sk.lo, e.ev.damageAt(0.97, false, e.ev.sizeProcChance === 1));
    sk.hi = Math.max(sk.hi, e.ev.damageAt(1.03, e.ev.critRate > 0, e.ev.sizeProcChance > 0));
    return { t: e.t, kind: e.kind, sk, ev: e.ev, hitRate: e.ev.hitRate, critRate: e.ev.critRate, proc: e.proc, prob: e.prob ?? 1,
      token: e.token, requiresHit: e.requiresHit, icdKey: e.icdKey, icdMs: e.icdMs, primaryCast: e.primaryCast, shareCast: e.shareCast, sharePct: e.sharePct,
      bucket: Math.min(nBuckets - 1, Math.floor(e.t / bucketMs)) };
  });
  for (const sk of skills) {
    // Never more histogram bins than distinct integer damage values (tiny hits would otherwise alternate empty/full bins).
    const n = Math.max(1, Math.min(bins, Math.round(sk.hi - sk.lo) + 1));
    sk.normalBins = new Uint32Array(n);
    sk.critBins = new Uint32Array(n);
  }

  const totals = new Float64Array(runs);
  const cumulative = new Float64Array(runs * (nBuckets + 1));
  const perRunBucket = new Float64Array(nBuckets);
  const sampleRun = options.captureRun ? [] : null;
  for (let r = 0; r < runs; r++) {
    perRunBucket.fill(0);
    const landed = new Set(), procReady = new Map(), primaryDamage = new Map();
    let total = 0;
    for (const e of events) {
      if (e.requiresHit !== undefined) {
        if (!landed.has(e.requiresHit) || e.t < (procReady.get(e.icdKey) ?? 0)) continue;
        if (e.icdMs > 0) procReady.set(e.icdKey, e.t + e.icdMs);
      } else if (e.prob < 1 && rng() >= e.prob) continue;
      if (e.sharePct && !(primaryDamage.get(e.shareCast) > 0)) continue;
      const sk = e.sk;
      let dmg = 0, crit = false, miss = false, extraDamage = 0, sizeProc = false;
      if (e.hitRate < 1 && rng() >= e.hitRate) {
        sk.misses++;
        miss = true;
      } else {
        if (e.sharePct) dmg = Math.round((primaryDamage.get(e.shareCast) ?? 0) * e.sharePct);
        else {
          const roll = 0.97 + rng() * 0.06;
          crit = !e.ev.magic && rng() < e.critRate;
          // ponytail: Shadow Drake rolls per landed damage packet; share one cast roll if native server evidence establishes it.
          sizeProc = e.ev.sizeProcChance > 0 && rng() < e.ev.sizeProcChance;
          dmg = e.ev.damageAt(roll, crit, sizeProc);
        }
        const nb = sk.normalBins.length;
        const bin = Math.max(0, Math.min(nb - 1, Math.floor(((dmg - sk.lo) / (sk.hi - sk.lo + 1)) * nb)));
        if (crit) {
          sk.crits++;
          sk.critBins[bin]++;
        } else {
          sk.hits++;
          sk.normalBins[bin]++;
        }
      }
      for (const pr of e.proc ?? []) if (rng() < pr.p) { extraDamage += pr.dmg; dmg += pr.dmg; }
      if (!miss && e.token !== undefined) landed.add(e.token);
      if (e.primaryCast !== undefined) primaryDamage.set(e.primaryCast, (primaryDamage.get(e.primaryCast) ?? 0) + dmg);
      if (sampleRun && r === 0) sampleRun.push({ t: e.t, id: sk.id, name: sk.name, kind: e.kind, damage: dmg, crit, miss, extraDamage, ...(sizeProc ? { sizeProc: true } : {}) });
      total += dmg;
      perRunBucket[e.bucket] += dmg;
      sk.total += dmg;
      sk.perBucket[e.bucket] += dmg;
    }
    totals[r] = total;
    const base = r * (nBuckets + 1);
    for (let b = 0; b < nBuckets; b++) cumulative[base + b + 1] = cumulative[base + b] + perRunBucket[b];
  }
  for (const sk of skills) {
    sk.total /= runs;
    for (let b = 0; b < nBuckets; b++) sk.perBucket[b] /= runs;
  }

  return { runs, durationMs, bucketMs, nBuckets, bins, expectedTotal: deterministic.totalExpectedDamage, deterministic, totals, cumulative, skills, ...(sampleRun ? { sampleRun } : {}) };
}

// ============================================================================
// 6c. Class Profiles (sample gear + candidate rotations per career; used by the CLI report and the HTML simulator)
// ============================================================================

export const CLASS_PROFILES = {
  swordman: {
    name: 'Knight / Swordman (Physical Melee)',
    career: 1200,
    equipmentAttrs: [[103, 180], [1, 8], [5, 4]],
    weaponRefine: 6,
    weaponStrengthen: 10,
    stunts: [10010401, 10010404],
    totemCastStackBuffId: 2500701,
    candidateRotations: [
      { name: 'Bowling Bash + Magnum Break + Bash weave', skills: [1110410, 1100210, 1100110] },
      { name: 'Aura Blade + Bowling Bash + Auto-Attack', skills: [1120110, 1110410] },
      { name: 'Bash Spam Only (No Cooldown)', skills: [1100110] },
      { name: 'Normal Auto-Attack Only', skills: [] },
    ],
  },
  mage: {
    name: 'Wizard / Mage (Elemental Magic)',
    career: 2200,
    equipmentAttrs: [[104, 210], [4, 10], [5, 5]],
    weaponRefine: 6,
    weaponStrengthen: 10,
    passiveSkills: [1220910],
    totems: [{ guid: 1, skills: [10051001, 10053001, 10053005, 10052017] }],
    totemCastStackBuffId: 2500401,
    totemExtraMaxStack: 1,
    candidateRotations: [
      { name: 'Fire Wall (Ground DoT) + Fire Ball + Fire Bolt', skills: [1201010, 1201210, 1200410] },
      { name: 'Storm Gust (Ground DoT) + Jupitel Thunder + Fire Bolt', skills: [1210810, 1210210, 1200410] },
      { name: 'Fire Bolt Lv10 Spam Only', skills: [1200410] },
    ],
  },
  archer: {
    name: 'Hunter / Archer (Ranged Physical)',
    career: 3200,
    equipmentAttrs: [[103, 175], [5, 9], [2, 6]],
    weaponRefine: 6,
    weaponStrengthen: 10,
    passiveSkills: [1300110, 1300210],
    totemCastStackBuffId: 2500301,
    candidateRotations: [
      { name: 'Attention Concentrate + Falcon Assault + Double Strafe', skills: [1300610, 1320210, 1300310] },
      { name: 'Attention Concentrate + Focused Arrow Strike (ASPD Crit)', skills: [1300610, 1320410] },
      { name: 'Double Strafe Spam Only', skills: [1300310] },
    ],
  },
  thief: {
    name: 'Assassin / Thief (Crit & Burst Melee)',
    career: 5200,
    equipmentAttrs: [[103, 170], [1, 7], [2, 8], [6, 5]],
    weaponRefine: 6,
    weaponStrengthen: 10,
    passiveSkills: [1500110],
    totemCastStackBuffId: 2500701,
    candidateRotations: [
      { name: 'Cross Impact (ASPD-scaled) Spam', skills: [1522210] },
      { name: 'Grimtooth + Envenom + Sonic Blow', skills: [1510910, 1500510, 1510210] },
    ],
  },
  ranger: {
    name: 'Ranger (4th Job Ranged Physical - Bow / Warg)',
    career: 3400,
    equipmentAttrs: [[103, 280], [5, 14], [2, 10], [6, 8]],
    weaponRefine: 8,
    weaponStrengthen: 15,
    passiveSkills: [1300110, 1300210, 1310410, 1310510, 1330110, 1331110],
    totemCastStackBuffId: 2500301,
    candidateRotations: [
      { name: 'Unlimited + True Sight + Arrow Storm + Focused Arrow + Sharp Shooting', skills: [1330705, 1320310, 1300610, 1330205, 1330505, 1320410] },
      { name: 'Warg Build: King of Wargs + Warg Hunt + Warg Bite + Focused Arrow', skills: [1332205, 1320310, 1332305, 1332505, 1330505] },
      { name: 'ASPD Crit: Fear Breeze + True Sight + Focused Arrow Strike (0 CD, 100% ASPD)', skills: [1330305, 1320310, 1300610, 1330505] },
      { name: 'Myriad Stars + Arrow Storm + Double Strafe Weave', skills: [1332005, 1330205, 1300310] },
    ],
  },
  mechanic: {
    name: 'Mechanic (4th Job Physical - Battle Axe / Madogear)',
    career: 6400,
    equipmentAttrs: [[103, 310], [1, 15], [5, 8], [6, 6]],
    weaponRefine: 8,
    weaponStrengthen: 15,
    passiveSkills: [1610105, 1610205, 1630105, 1630205],
    totemCastStackBuffId: 2500701,
    candidateRotations: [
      { name: 'Madogear Burst: Energy Release (2200%) + Flame Launcher (600%) + Pile Bunker + Vulcan Arm', skills: [1620410, 1610505, 1631701, 1631505, 1631403, 1631305] },
      { name: 'Battle Axe: Max Over Thrust + Crescent Wheel (600%) + High-Energy Impact + Heavy Axe Smash', skills: [1620410, 1610505, 1630805, 1630705, 1630505] },
      { name: 'Axe Tornado AoE + Spinning Axe + Heavy Axe Smash (0 CD Filler)', skills: [1620410, 1630405, 1630605, 1630505] },
      { name: 'High Speed Cart Ram Spam (200ms CD, 833ms Action)', skills: [1620410, 1610505, 1620210] },
    ],
  },
  runeknight: {
    name: 'Rune Knight (4th Job Melee Physical)',
    career: 1400,
    equipmentAttrs: [[103, 290], [1, 14], [2, 8], [5, 8]],
    weaponRefine: 8,
    weaponStrengthen: 15,
    totemCastStackBuffId: 2500701,
    candidateRotations: [
      { name: 'Aura Blade + Hundred Spears + Ignition Break + Bowling Bash', skills: [1120110, 1130305, 1130405, 1110410] },
    ],
  },
  royalguard: {
    name: 'Royal Guard DPS (Melee Physical)',
    career: 1410,
    equipmentAttrs: [[103, 290], [1, 14], [2, 8], [5, 8]],
    weaponRefine: 8,
    weaponStrengthen: 15,
    totemCastStackBuffId: 2500701,
    candidateRotations: [
      { name: 'Shield Press + Earth Drive + Powerful Shield Bash', skills: [1160805, 1161105, 1163605] },
      { name: 'Heavy Cannon Shot + Blood Cross + Banishing Thrust', skills: [1160205, 1160405, 1160105] },
      { name: 'Twilight + Fearless Charge + Crescent Moon', skills: [1160710, 1162405, 1162805] },
    ],
  },
  warlock: {
    name: 'Warlock (4th Job Elemental Magic)',
    career: 2400,
    equipmentAttrs: [[104, 310], [4, 15], [5, 10]],
    weaponRefine: 8,
    weaponStrengthen: 15,
    totemCastStackBuffId: 2500401,
    candidateRotations: [
      { name: 'Chain Lightning + Crimson Rock + Jack Frost + Soul Expansion', skills: [1231405, 1231105, 1230805, 1231505] },
    ],
  },
  guillotinecross: {
    name: 'Guillotine Cross (4th Job Crit / Poison Assassin)',
    career: 5400,
    equipmentAttrs: [[103, 285], [1, 12], [2, 12], [6, 10]],
    weaponRefine: 8,
    weaponStrengthen: 15,
    totemCastStackBuffId: 2500701,
    candidateRotations: [
      { name: 'Cross Impact (ASPD-scaled) + Rolling Cutter + Cross Ripper Slasher', skills: [1522210] },
    ],
  },
};

// ============================================================================
// 6d. Final-value calibration (type the number the game shows, get the bonus that produces it)
// ============================================================================

/**
 * Returns the flat bonus `v` to add to `build.equipmentAttrs` as `[attr, v]` (pre-multiplier, so percent bonuses keep scaling it)
 * so that `buildCharacterStats(build)[attr]` equals `target` exactly, through the percent groups and the ceil/round rules of
 * `computeStatSheet`. Throws when the attribute cannot reach the target (its multiplier is not positive).
 */
export function solveAttributeBonus(build, attr, target, data = new Ro3DataStore()) {
  const at = (v) => buildCharacterStats({ ...build, equipmentAttrs: [...(build.equipmentAttrs ?? []), [attr, v]] }, data)[attr];
  let v = 0;
  for (let i = 0; i < 12; i++) {
    const cur = at(v);
    if (cur === target) return Math.round(v) !== v && at(Math.round(v)) === target ? Math.round(v) : v;
    const slope = (at(v + 64) - cur) / 64;
    if (!(slope > 0.05)) throw new Error(`Attribute ${attr} cannot be moved to ${target} (multiplier ${slope.toFixed(2)})`);
    v += (target - cur) / slope;
  }
  // The ceil/round steps can leave the secant one step off; scan a small neighbourhood for the exact value.
  for (let k = -10; k <= 10; k++) if (at(v + k / 10) === target) return v + k / 10;
  throw new Error(`Attribute ${attr} did not converge on ${target}`);
}

/**
 * The hidden flat bonuses (a Map attribute -> value, the shape of `build.equipmentAttrs`) that make `build`'s sheet show `want` ({ attribute: final value }). The
 * build's own `equipmentAttrs` of other attributes stay as they are, those of the wanted ones are solved again; what is left is the part of the numbers that nothing
 * else in the build explains, so adding a source to the build and solving again shrinks it by what the source gives. Percent attributes go first (a typed P.ATK %
 * moves the P.ATK it multiplies), then the rest by id, so a base stat settles before the stats built from it; a few passes cover what is left. An attribute the
 * sheet cannot reach is left out.
 */
export function solveBonuses(build, want, data = new Ro3DataStore()) {
  const percent = (a) => (Number(data.row('AttributeConfig', a)?._iDataType) === 1 ? 0 : 1);
  const attrs = Object.keys(want).map(Number).sort((a, b) => percent(a) - percent(b) || a - b);
  const bonus = new Map((build.equipmentAttrs ?? []).filter(([a]) => !(a in want)));
  const show = () => buildCharacterStats({ ...build, equipmentAttrs: [...bonus] }, data);
  for (let pass = 0; pass < 4; pass++) {
    const now = show();
    const off = attrs.filter((a) => now[a] !== want[a]);
    if (!off.length) break;
    for (const a of off) {
      const others = [...bonus].filter(([k]) => k !== a);
      try {
        const v = solveAttributeBonus({ ...build, equipmentAttrs: others }, a, want[a], data);
        if (v) bonus.set(a, v);
        else bonus.delete(a);
      } catch { /* the sheet cannot reach it */ }
    }
  }
  return bonus;
}

// ============================================================================
// 6e. Season Talents (SeasonTalentTreeConfig / SeasonTalentConfig / SeasonTalentEffectConfig, digested by build-ro3-sim.mjs into `TalentDigest`)
// ============================================================================

/**
 * `build.talents` = { lv, picks, prof, skills }. The talent system is a chain of trees: in a tree every node opens when the one before it is at its maximum
 * ("Level-up is only available after all prerequisite talent nodes reach Max level"), and a tree opens when the job rank and base level of its condition are
 * met and the total Talent Lv reaches its `_iNeedLevel` ("Unlocks when total Talent Lv. reaches N"). The nodes are stat nodes (a fixed amount per level, paid in
 * Talent Remnants and Minted Coins) and branch points (the game's SkillPoint nodes, activated for free) where one job talent cluster is chosen, then one of its
 * talents ("Selecting class talents costs nothing, and they can be Replaced at any time").
 *   lv      the Talent Lv, the total the game shows: every stat level and every branch point counts 1, and so does the pick made at a branch point
 *   picks   { branch point: [cluster, talent] }; a missing or invalid pick takes the first option the job and profession have
 *   prof    the profession (JobProfessConfig id): a cluster lists the professions it suits
 *   skills  { skill group: learned level }, for the talents that need a skill level
 * `talentWalk` spends `lv` along the chain, `talentEffects` turns the result into attributes (stat nodes, job talents that add a stat) and buffs (job talents that
 * change a skill, applied while the simulation runs). ponytail: the 5 plans of the game are the simulator's tabs; the Battle Pledge (PvP) node and the
 * server-day part of the tree conditions are not simulated; the pick counts 1 once per branch point (the cluster and its talent both apply), because that is
 * how the trees add up: tree II needs 86 more levels, 80 stat levels + 3 branch points + 3 picks, and II+1 and II+2 need 102 = 100 + 1 + 1.
 */
const talentDigest = (data) => data.row('TalentDigest', 1) ?? null;
// The row of a job talent node for a job and profession: one row per job family (empty `jobs` = any job), narrowed by the professions it suits (empty = all).
// Without a profession (`prof` 0: a character that has not picked one, whose game offers every talent group) any row of the job fits.
function talentRow(node, career, prof, D) {
  const rows = asArray(D.jobs[node]);
  const fits = (r) => !prof || !r.profs.length || r.profs.includes(prof);
  return rows.find((r) => r.jobs.includes(career) && fits(r)) ?? rows.find((r) => !r.jobs.length && fits(r)) ?? null;
}
/** The clusters a branch point offers a job and profession, each with its talents: [{ id, name, text, sim, kids: [{ id, name, text, sim }] }] (`sim` 2 simulated, 1 partly, 0 not). */
export function talentOptions(branch, career, prof, data) {
  const D = talentDigest(data);
  return asArray(D?.branches[branch]).flatMap((b) => {
    const row = talentRow(b.n, career, prof, D);
    const kids = b.kids.flatMap((k) => { const r = talentRow(k, career, prof, D); return r ? [{ id: k, ...r }] : []; });
    return row ? [{ id: b.n, ...row, kids }] : [];
  });
}
/** The cluster and talent in effect at a branch point: [cluster, talent] (0 where the job has none). */
export function talentPick(talents, branch, career, data) {
  const options = talentOptions(branch, career, talents?.prof, data);
  const [c, k] = asArray(talents?.picks?.[branch]);
  const cluster = options.find((o) => o.id === c) ?? options[0];
  return [cluster?.id ?? 0, (cluster?.kids.find((x) => x.id === k) ?? cluster?.kids[0])?.id ?? 0];
}
/** Spends `build.talents.lv` along the chain: { trees: [{ id, name, need, rank, lv, cap, done, state }], nodes: [{ n, ty, max, g, tree, lv, picked }], reached: the branch points with their pick, cost: { mats, coin }, total, spare }. */
export function talentWalk(build, data) {
  const D = talentDigest(data);
  const out = { trees: [], nodes: [], reached: [], cost: { mats: 0, coin: 0 }, total: 0, spare: 0 };
  if (!D) return out;
  const t = build.talents ?? {};
  const rank = Number(data.row('JobConfig', build.career)?._iJobRank ?? 0);
  let left = Math.max(0, Math.trunc(Number(t.lv)) || 0);
  for (const tree of D.trees) {
    const state = rank < tree.rank || Number(build.level ?? 1) < tree.lv ? 'locked' : out.total < tree.need ? 'short' : 'open'; // class / base level, then Talent Lv
    const row = { id: tree.id, name: tree.name, need: tree.need, rank: tree.rank, lv: tree.lv, cap: tree.chain.reduce((s, n) => s + n.max + (n.ty === 5 ? 1 : 0), 0), done: 0, state };
    out.trees.push(row);
    for (const node of tree.chain) {
      const take = state === 'open' ? Math.min(node.max, left) : 0;
      const entry = { ...node, tree: tree.id, lv: take, picked: 0 };
      out.nodes.push(entry);
      left -= take;
      out.total += take;
      row.done += take;
      if (!take) continue;
      if (node.ty !== 5) {
        out.cost.mats += D.groups[node.g].cost[0] * take;
        out.cost.coin += D.groups[node.g].cost[1] * take;
      } else if (left > 0) { // the pick made at the branch point counts one more level
        left--;
        out.total++;
        row.done++;
        entry.picked = 1;
        out.reached.push(node.n);
      }
    }
  }
  out.spare = left;
  return out;
}
/** The most Talent Lv this job can have at this base level. */
export const talentMax = (build, data) => talentWalk({ ...build, talents: { ...build.talents, lv: Infinity } }, data).total;
/** What the talents give: { attrs: [[attribute, value]] for the sheet, buffs: [buff ids] for the simulation, walk }. */
export function talentEffects(build, data) {
  const D = talentDigest(data);
  const out = { attrs: [], buffs: [], walk: null };
  const t = build.talents;
  if (!D || !(Number(t?.lv) > 0)) return out;
  const sum = new Map();
  const add = (a, v) => sum.set(a, (sum.get(a) ?? 0) + v);
  out.walk = talentWalk(build, data);
  for (const n of out.walk.nodes) if (n.lv > 0 && n.g) for (const [a, v] of D.groups[n.g].per) add(a, v * n.lv);
  for (const branch of out.walk.reached) {
    for (const id of talentPick(t, branch, build.career, data).filter(Boolean)) {
      const row = talentRow(id, build.career, t.prof, D);
      for (const [a, v] of row.a) add(a, v);
      for (const [g, lv, a, v] of row.c) if ((Number(t.skills?.[g]) || 0) >= lv) add(a, v);
      out.buffs.push(...row.b);
    }
  }
  out.attrs = [...sum];
  return out;
}
