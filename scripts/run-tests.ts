/**
 * Run all mahjong-bot test suites.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const suites = [
  { name: "bitboard", script: "test-bitboard.ts", needsTable: false },
  { name: "shanten", script: "test-shanten.ts", needsTable: false },
  { name: "special-shanten", script: "test-special-shanten.ts", needsTable: false },
  { name: "softmax", script: "test-softmax.ts", needsTable: false },
  { name: "encoding", script: "test-encoding.ts", needsTable: false },
  { name: "win-rate", script: "test-win-rate.ts", needsTable: false },
  { name: "waits", script: "test-waits.ts", needsTable: false },
  { name: "tile-tracker", script: "test-tile-tracker.ts", needsTable: false },
  { name: "fan-potential", script: "test-fan-potential.ts", needsTable: false },
  { name: "opponent-threat", script: "test-opponent-threat.ts", needsTable: false },
  { name: "match-context", script: "test-match-context.ts", needsTable: false },
  { name: "ev-scorer", script: "test-ev-scorer.ts", needsTable: false },
  { name: "monte-carlo", script: "test-monte-carlo.ts", needsTable: false },
  { name: "self-play-schema", script: "test-self-play-schema.ts", needsTable: true },
  { name: "view-contract", script: "test-view-contract.ts", needsTable: true },
  { name: "bench-gate", script: "test-bench-gate.ts", needsTable: true },
];

console.log("mahjong-bot test suite\n");

let tableBuilt = false;
const skipIntegration = process.env.SKIP_INTEGRATION === "1";

for (const suite of suites) {
  if (skipIntegration && suite.needsTable) continue;
  console.log(`▶ ${suite.name}`);
  if (suite.needsTable && !tableBuilt) {
    const buildTable = spawnSync("npm", ["run", "build"], {
      cwd: path.join(root, "..", "mahjong-table"),
      stdio: "inherit",
    });
    if (buildTable.status !== 0) {
      console.error("mahjong-table build failed (required for integration tests)");
      process.exit(1);
    }
    tableBuilt = true;
  }
  const result = spawnSync("npx", ["tsx", path.join(__dirname, suite.script)], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      ...(suite.name === "bench-gate" ? { MATCHES: "2", MAX_ACTIONS: "300" } : {}),
    },
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${suite.name} failed`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n✓ All test suites passed");
