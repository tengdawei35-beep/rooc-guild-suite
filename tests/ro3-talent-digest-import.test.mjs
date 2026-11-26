import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import {
  decodeLegacySimulatorData,
  decodeNativeGameData,
  mergeTalentDigest,
  updateNativeGameDataSource,
} from "../scripts/import-ro3-talent-digest.mjs";

const digest = {
  _iID: 1,
  items: ["Talent Remnant", "Minted Coin"],
  trees: [{ id: 10, name: "Season I", need: 0, rank: 2, lv: 100, chain: [{ n: 1, ty: 1, max: 5, g: 20 }] }],
  groups: { 20: { name: "Strength", per: [[3, 2]], cost: [1, 2] } },
  branches: { 50: [{ n: 51, kids: [52] }] },
  jobs: { 51: [{ jobs: [1410], profs: [1], name: "Guard", text: "Example", sim: 2, a: [], b: [9001, 9002], c: [] }] },
};
const sourceData = {
  generated: "2026-11-26",
  tables: {
    TalentDigest: { 1: digest },
    BuffConfig: { 9001: { _iID: 9001, _kChangeAttri: [[103, 10]] }, 9002: { _iID: 9002, _kChangeAttri: [[104, 20]] } },
  },
  ui: {},
};
const nativeData = {
  generated: "2026-11-25",
  tables: { BuffConfig: { 9001: { _iID: 9001, _kChangeAttri: [[103, 10]] } }, JobConfig: { 1410: { _iID: 1410 } } },
  ui: { jobs: [{ id: 1410, name: "Royal Guard" }] },
};
const encode = (value) => gzipSync(Buffer.from(JSON.stringify(value))).toString("base64");
const nativeModule = (data) => `const RO3_GAME_DATA_GZIP_BASE64 =\\n  "${encode(data)}";\\nexport const RO3_GAME_DATA_COMPRESSED_BYTES = 1;\\n`;
const legacyHtml = (data) => `<!doctype html><script type="text/plain" id="ro3-data">${encode(data)}</script>`;

test("reads the generated TalentDigest from the upstream simulator HTML payload", () => {
  const decoded = decodeLegacySimulatorData(legacyHtml(sourceData));
  assert.deepEqual(decoded.tables.TalentDigest[1], digest);
});

test("merges the exact digest and only the missing talent buffs into native data", () => {
  const target = structuredClone(nativeData);
  const result = mergeTalentDigest(target, sourceData);
  assert.deepEqual(target.tables.TalentDigest[1], digest);
  assert.deepEqual(result.referencedBuffIds, [9001, 9002]);
  assert.deepEqual(result.addedBuffIds, [9002]);
  assert.deepEqual(target.tables.BuffConfig[9002], sourceData.tables.BuffConfig[9002]);
  assert.deepEqual(target.tables.JobConfig, nativeData.tables.JobConfig);
  assert.deepEqual(target.ui, nativeData.ui);
});

test("round-trips the updated native compressed module and byte metadata", () => {
  const updated = updateNativeGameDataSource(nativeModule(nativeData), { ...nativeData, tables: { ...nativeData.tables, TalentDigest: { 1: digest } } });
  assert.equal(decodeNativeGameData(updated.source).tables.TalentDigest[1]._iID, 1);
  assert.match(updated.source, new RegExp(`RO3_GAME_DATA_COMPRESSED_BYTES = ${updated.compressedBytes};`));
});

test("fails closed when the source digest or one of its referenced buffs is missing", () => {
  assert.throws(() => decodeLegacySimulatorData(legacyHtml({ tables: {}, ui: {} })), /valid TalentDigest/);
  const missingBuff = structuredClone(sourceData);
  delete missingBuff.tables.BuffConfig[9002];
  assert.throws(() => mergeTalentDigest(structuredClone(nativeData), missingBuff), /no matching BuffConfig row/);
});

test("rejects source HTML without the upstream data payload", () => {
  assert.throws(() => decodeLegacySimulatorData("<html></html>"), /missing its <script id="ro3-data"> payload/);
});
