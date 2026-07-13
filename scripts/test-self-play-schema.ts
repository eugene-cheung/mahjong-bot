/**
 * Self-play v2 schema smoke test — one short match + join.
 */

import { readFileSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { joinRewards, loadSelfPlayRecords, parseSelfPlayLine } from "../src/self-play/join.js";
import { assertEq, assertGt, assertTrue, section } from "./lib/test-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const samplePath = path.join(root, "data", "schema-test.jsonl");

section("run self-play sample");

mkdirSync(path.join(root, "data"), { recursive: true });
try {
  rmSync(samplePath, { force: true });
} catch {
  /* ignore */
}

const run = spawnSync("npx", ["tsx", path.join(__dirname, "self-play.ts")], {
  cwd: root,
  env: {
    ...process.env,
    MATCHES: "1",
    MAX_ACTIONS: "250",
    OUT: samplePath,
    DETERMINISTIC: "1",
  },
  stdio: "inherit",
});
if (run.status !== 0) process.exit(run.status ?? 1);

const lines = readFileSync(samplePath, "utf8").trim().split("\n");
assertGt("produced log lines", lines.length, 10);

const records = loadSelfPlayRecords(lines);
const decisions = records.filter((r) => r.kind === "decision");
const handEnds = records.filter((r) => r.kind === "hand_end");

assertGt("v2 decision rows", decisions.length, 5);
assertTrue("decisions have legal EVs", decisions.every((d) => d.legal.length > 0 && d.legal.every((a) => typeof a.ev === "number")));
assertTrue("decisions have state.hand", decisions.every((d) => d.state.hand.length > 0));

const claimRows = decisions.filter((d) => d.phase === "claim_window");
assertGt("claim window rows logged", claimRows.length, 1);

const first = parseSelfPlayLine(lines[0]!);
assertTrue("first row is v2 decision", first?.kind === "decision" && first.v === 2);

section("join rewards");

const joined = joinRewards(records);
assertEq("training rows match decisions", joined.trainingRows.length, decisions.length);
assertTrue(
  "training rows have reward fields",
  joined.trainingRows.every((r) => typeof r.handReward === "number" && typeof r.matchReward === "number"),
);

console.log("\nAll self-play schema tests passed");
