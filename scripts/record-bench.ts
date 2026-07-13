/**
 * Run benchmark and save results; compare to baseline.
 * Usage: npm run bench:record
 *        npm run bench:record -- "after 50-match self-play tune"
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runBenchmark,
  formatBenchmarkSummary,
  compareToBaseline,
  formatDelta,
  type BenchmarkResult,
} from "./lib/bench-run.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const BASELINE_PATH = path.join(root, "benchmarks", "baseline-v0.3-pre-self-play.json");
const RUNS_DIR = path.join(root, "benchmarks", "runs");

const MATCHES = Number(process.env.MATCHES ?? 5);
const MAX_ACTIONS = Number(process.env.MAX_ACTIONS ?? 400);
const note = process.argv[2];

function loadBaseline(): BenchmarkResult | null {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as BenchmarkResult;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  mkdirSync(RUNS_DIR, { recursive: true });

  const result = await runBenchmark(
    { matches: MATCHES, maxActions: MAX_ACTIONS },
    (m, total) => process.stderr.write(`  match ${m}/${total}…\n`),
  );

  if (note) result.label = note;

  const stamp = result.recordedAt.replace(/[:.]/g, "-");
  const outPath = path.join(RUNS_DIR, `${stamp}.json`);
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(path.join(RUNS_DIR, "latest.json"), `${JSON.stringify(result, null, 2)}\n`);

  console.log(formatBenchmarkSummary(result));
  console.log(`\nSaved → ${outPath}`);

  const baseline = loadBaseline();
  if (baseline) {
    console.log(`\n${formatDelta(compareToBaseline(result, baseline), baseline.label ?? "baseline")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
