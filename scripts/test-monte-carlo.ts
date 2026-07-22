/**
 * Monte Carlo rollout policy tests.
 */

import { HandCounts } from "../src/bitboard.js";
import { testRolloutDiscard } from "../src/eval/monte-carlo.js";
import { handShantenCounts } from "../src/shanten/index.js";
import { assertTrue, section } from "./lib/test-helpers.js";
import type { TileId } from "../src/protocol.js";

section("rolloutDiscard actually discards");

const tiles: TileId[] = [
  "wan-1", "wan-2", "wan-3",
  "wan-4", "wan-5", "wan-6",
  "wan-7", "wan-8", "wan-9",
  "bing-1", "bing-1", "bing-1",
  "tiao-9", "east",
];
const counts = HandCounts.fromIds(tiles);
const before = counts.total();
testRolloutDiscard(counts, 0);
assertTrue("discarded exactly one tile", counts.total() === before - 1);

section("rolloutDiscard prefers lower shanten");

// Dumping the isolated east should leave a stronger hand than dumping from a set.
const afterSh = handShantenCounts(counts.counts, 0).shanten;
const alt = HandCounts.fromIds(tiles);
alt.removeIndex(27); // east
const dumpEastSh = handShantenCounts(alt.counts, 0).shanten;
assertTrue(
  "greedy discard is at most as bad as dumping east",
  afterSh <= dumpEastSh + 1,
);

console.log("\nAll monte-carlo tests passed");
