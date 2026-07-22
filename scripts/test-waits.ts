/**
 * Wait enumeration tests.
 */

import { HandCounts } from "../src/bitboard.js";
import { enumerateWaits, waitQualityScore } from "../src/eval/waits.js";
import { TileTracker } from "../src/eval/tile-tracker.js";
import { assertEq, assertGt, assertTrue, section } from "./lib/test-helpers.js";
import type { GameState, TileId } from "../src/protocol.js";

function emptyView(eastTiles: TileId[]): GameState {
  const concealed = eastTiles.map((id, i) => ({ instanceId: `e${i}`, tileId: id }));
  return {
    phase: "turn_discard",
    rulesetId: "hong-kong",
    wall: { live: Array.from({ length: 40 }, (_, i) => ({ instanceId: `w${i}`, tileId: "wan-1" as TileId })), dead: [] },
    discards: [],
    hands: {
      east: { seat: "east", concealed, melds: [], revealedBonus: [] },
      south: { seat: "south", concealed: [], melds: [], revealedBonus: [] },
      west: { seat: "west", concealed: [], melds: [], revealedBonus: [] },
      north: { seat: "north", concealed: [], melds: [], revealedBonus: [] },
    },
  };
}

section("tenpai ryanmen waits");

// 123 456 789 wan + 11 bing + 2-3 tiao → waits tiao-1 and tiao-4 (13 tiles)
const tenpai: TileId[] = [
  "wan-1", "wan-2", "wan-3",
  "wan-4", "wan-5", "wan-6",
  "wan-7", "wan-8", "wan-9",
  "bing-1", "bing-1",
  "tiao-2", "tiao-3",
];
const counts = HandCounts.fromIds(tenpai).counts;
const tracker = TileTracker.fromView(emptyView(tenpai), "east");
const waits = enumerateWaits(counts, 0, tracker);
assertTrue("has waits", waits.waits.includes("tiao-1") && waits.waits.includes("tiao-4"));
assertGt("ukeire > 0", waits.totalRemaining, 0);
assertGt("wait quality positive", waitQualityScore(waits), 0);

section("non-tenpai has no waits");

const far: TileId[] = [
  "wan-1", "wan-3", "wan-5", "wan-7", "wan-9",
  "tiao-1", "tiao-3", "tiao-5", "tiao-7", "tiao-9",
  "bing-1", "bing-5", "east",
];
const farWaits = enumerateWaits(HandCounts.fromIds(far).counts, 0, tracker);
assertEq("no waits when not tenpai", farWaits.waits.length, 0);

console.log("\nAll waits tests passed");
