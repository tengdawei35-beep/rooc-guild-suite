#!/usr/bin/env node
/**
 * Import the authoritative Season Talent digest from the RO3 damage simulator.
 *
 * The upstream simulator builds TalentDigest from the client config tables and
 * embeds the generated row in ro3-damage-sim.html. This importer transfers that
 * generated row (and every BuffConfig row it references) into Heimdall's native
 * game-data payload without reimplementing or approximating the source logic.
 *
 * Usage:
 *   node scripts/import-ro3-talent-digest.mjs --source-html <path-to-ro3-damage-sim.html>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGET = path.resolve(here, "../src/lib/ro3-combat-simulator/data/ro3-game-data.ts");

function requireTalentDigest(data, label) {
  const digest = data?.tables?.TalentDigest?.[1];
  if (!digest || Number(digest._iID) !== 1 || !digest.trees || !digest.groups || !digest.branches || !digest.jobs) {
    throw new Error(`${label} does not contain a valid TalentDigest row (tables.TalentDigest[1]).`);
  }
  return digest;
}

/** Decode the generated data block embedded by upstream build-ro3-sim.mjs. */
export function decodeLegacySimulatorData(html) {
  const match = html.match(/<script\b(?=[^>]*\bid=["']ro3-data["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('Source simulator HTML is missing its <script id="ro3-data"> payload.');
  const encoded = match[1].trim();
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) throw new Error("Source simulator data payload is not valid base64.");
  let data;
  try {
    data = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
  } catch (error) {
    throw new Error(`Unable to decode source simulator data payload: ${error instanceof Error ? error.message : String(error)}`);
  }
  requireTalentDigest(data, "Source simulator data");
  return data;
}

/** Read and decode the compressed payload from Heimdall's TypeScript module. */
export function decodeNativeGameData(source) {
  const declaration = source.match(/const RO3_GAME_DATA_GZIP_BASE64\s*=\s*([\s\S]*?);/);
  if (!declaration) throw new Error("Native game-data module is missing RO3_GAME_DATA_GZIP_BASE64.");
  const chunks = [...declaration[1].matchAll(/"([A-Za-z0-9+/=]+)"/g)].map((item) => item[1]);
  if (!chunks.length) throw new Error("Native game-data module has no compressed payload chunks.");
  try {
    return JSON.parse(gunzipSync(Buffer.from(chunks.join(""), "base64")).toString("utf8"));
  } catch (error) {
    throw new Error(`Unable to decode native game-data payload: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Copy the upstream digest and all referenced talent buffs into the native
 * dataset. Fail closed if any referenced buff is absent upstream.
 */
export function mergeTalentDigest(nativeData, sourceData) {
  const digest = requireTalentDigest(sourceData, "Source simulator data");
  if (!nativeData?.tables || !nativeData.tables.BuffConfig) {
    throw new Error("Native game data is missing tables.BuffConfig.");
  }
  const sourceBuffs = sourceData.tables.BuffConfig ?? {};
  const targetBuffs = nativeData.tables.BuffConfig;
  const referencedBuffIds = [...new Set(
    Object.values(digest.jobs).flat().flatMap((row) => Array.isArray(row.b) ? row.b.map(Number) : []),
  )];
  const addedBuffIds = [];
  for (const id of referencedBuffIds) {
    const key = String(id);
    const buff = sourceBuffs[key];
    if (!buff) throw new Error(`TalentDigest references buff ${id}, but the source simulator has no matching BuffConfig row.`);
    if (!targetBuffs[key]) {
      targetBuffs[key] = buff;
      addedBuffIds.push(id);
    }
  }
  nativeData.tables.TalentDigest = { 1: digest };
  return { addedBuffIds, referencedBuffIds };
}

/** Replace only the compressed payload and its byte-count metadata. */
export function updateNativeGameDataSource(source, data) {
  const declaration = source.match(/const RO3_GAME_DATA_GZIP_BASE64\s*=\s*([\s\S]*?);/);
  if (!declaration) throw new Error("Native game-data module is missing RO3_GAME_DATA_GZIP_BASE64.");
  const json = JSON.stringify(data);
  const compressed = gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  const base64 = compressed.toString("base64");
  const chunks = base64.match(/.{1,120}/g) ?? [];
  const lines = chunks.map((chunk, index) => `  "${chunk}"${index < chunks.length - 1 ? " +" : ""}`).join("\n");
  const replacement = `const RO3_GAME_DATA_GZIP_BASE64 =\n${lines};`;
  let updated = source.replace(declaration[0], replacement);
  const byteCount = updated.match(/export const RO3_GAME_DATA_COMPRESSED_BYTES\s*=\s*\d+;/);
  if (!byteCount) throw new Error("Native game-data module is missing RO3_GAME_DATA_COMPRESSED_BYTES.");
  updated = updated.replace(byteCount[0], `export const RO3_GAME_DATA_COMPRESSED_BYTES = ${compressed.length};`);
  return { source: updated, compressedBytes: compressed.length, jsonBytes: Buffer.byteLength(json) };
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const sourcePath = readArgument("--source-html");
  const targetPath = path.resolve(readArgument("--target-data") ?? DEFAULT_TARGET);
  if (!sourcePath) throw new Error("Missing required --source-html <path> argument.");
  const sourceData = decodeLegacySimulatorData(fs.readFileSync(path.resolve(sourcePath), "utf8"));
  const nativeSource = fs.readFileSync(targetPath, "utf8");
  const nativeData = decodeNativeGameData(nativeSource);
  const { addedBuffIds, referencedBuffIds } = mergeTalentDigest(nativeData, sourceData);
  const updated = updateNativeGameDataSource(nativeSource, nativeData);
  fs.writeFileSync(targetPath, updated.source);
  console.log(`Imported TalentDigest: ${nativeData.tables.TalentDigest[1].trees.length} trees, ${Object.keys(nativeData.tables.TalentDigest[1].jobs).length} job-talent nodes.`);
  console.log(`Talent buffs: ${referencedBuffIds.length} referenced, ${addedBuffIds.length} added to native BuffConfig.`);
  console.log(`Updated ${targetPath} (${updated.compressedBytes.toLocaleString()} compressed bytes; ${updated.jsonBytes.toLocaleString()} JSON bytes).`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
