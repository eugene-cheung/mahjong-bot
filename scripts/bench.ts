/**
 * Head-to-head benchmark: heuristic bot vs random bot.
 * Usage: npm run bench
 */

import { runBenchmark, formatBenchmarkSummary } from "./lib/bench-run.js";

const MATCHES = Number(process.env.MATCHES ?? 5);
const MAX_ACTIONS = Number(process.env.MAX_ACTIONS ?? 400);

async function main(): Promise<void> {
  const result = await runBenchmark(
    { matches: MATCHES, maxActions: MAX_ACTIONS },
    (m, total) => process.stderr.write(`  match ${m}/${total}…\n`),
  );
  console.log(formatBenchmarkSummary(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
