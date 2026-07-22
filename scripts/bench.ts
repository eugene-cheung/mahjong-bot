/**
 * Head-to-head benchmark.
 * Usage:
 *   npm run bench
 *   MODE=vs-heuristic npm run bench
 *
 * Env: MATCHES, MAX_ACTIONS, MODE=vs-random|vs-heuristic
 */

import { runBenchmark, formatBenchmarkSummary, type BenchMode } from "./lib/bench-run.js";

const MATCHES = Number(process.env.MATCHES ?? 5);
const MAX_ACTIONS = Number(process.env.MAX_ACTIONS ?? 400);
const MODE = (process.env.MODE ?? "vs-random") as BenchMode;

async function main(): Promise<void> {
  const result = await runBenchmark(
    { matches: MATCHES, maxActions: MAX_ACTIONS, mode: MODE },
    (m, total) => process.stderr.write(`  match ${m}/${total}…\n`),
  );
  console.log(formatBenchmarkSummary(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
