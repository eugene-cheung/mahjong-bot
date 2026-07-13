/**
 * Join v2 self-play logs with hand/match rewards → training.jsonl
 * Usage: npm run join-rewards -- data/self-play.jsonl [data/training.jsonl]
 */

import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { joinRewards, loadSelfPlayRecords, trainingRowToJson } from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inPath = process.argv[2] ?? path.join(__dirname, "..", "data", "self-play.jsonl");
const outPath = process.argv[3] ?? path.join(__dirname, "..", "data", "training.jsonl");

const text = readFileSync(inPath, "utf8").trim();
if (!text) {
  console.error(`No entries in ${inPath}`);
  process.exit(1);
}

const records = loadSelfPlayRecords(text.split("\n"));
const result = joinRewards(records);

mkdirSync(path.dirname(outPath), { recursive: true });
const stream = createWriteStream(outPath, { flags: "w" });
for (const row of result.trainingRows) {
  stream.write(`${trainingRowToJson(row)}\n`);
}
stream.end();

console.log(`Joined ${result.decisions} decisions from ${result.matches} matches (${result.hands} hands)`);
console.log(`Wrote ${result.trainingRows.length} training rows → ${outPath}`);
