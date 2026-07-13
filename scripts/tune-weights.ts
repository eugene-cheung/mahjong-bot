/**
 * Suggest profile weight tweaks from self-play JSONL logs.
 * Usage: npm run tune -- data/self-play.jsonl
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROFILES, tuneWeightsFromLogs, type SelfPlayLogEntry } from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = process.argv[2] ?? path.join(__dirname, "..", "data", "self-play.jsonl");

function loadLogs(file: string): SelfPlayLogEntry[] {
  const text = readFileSync(file, "utf8").trim();
  if (!text) return [];
  return text.split("\n").map((line) => JSON.parse(line) as SelfPlayLogEntry);
}

const entries = loadLogs(logPath);
if (entries.length === 0) {
  console.error(`No entries in ${logPath}`);
  process.exit(1);
}

console.log(`Loaded ${entries.length} log entries from ${logPath}\n`);

for (const profile of Object.keys(PROFILES) as Array<keyof typeof PROFILES>) {
  const report = tuneWeightsFromLogs(entries, profile);
  console.log(`Profile: ${profile}`);
  console.log(`  decisions: ${report.samples}, hand wins logged: ${report.wins}`);
  console.log(`  avg shanten: ${report.avgShantenOnDecision.toFixed(2)}`);
  console.log(`  avg fan on win: ${report.avgFanOnWin.toFixed(2)}`);
  console.log(`  suggested weights:`, JSON.stringify(report.suggested, null, 2));
  console.log();
}
