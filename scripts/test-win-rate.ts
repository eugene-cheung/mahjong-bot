/**
 * Win-rate estimation tests.
 */

import { estimateWinRate, winRateScore } from "../src/eval/win-rate.js";
import { TileTracker } from "../src/eval/tile-tracker.js";
import { countsFromIds } from "../src/tiles.js";
import type { GameState, TileId } from "../src/protocol.js";
import { assertGt, assertLt, section } from "./lib/test-helpers.js";

function tile(id: TileId, instanceId: string) {
  return { instanceId, tileId: id };
}

function minimalView(hand: TileId[], wallSize: number): GameState {
  return {
    phase: "turn_discard",
    rulesetId: "hong-kong",
    handIndex: 1,
    scores: { east: 0, south: 0, west: 0, north: 0 },
    wall: { live: Array.from({ length: wallSize }, (_, i) => tile("wan-1", `w-${i}`)), dead: [] },
    discards: [],
    dealer: { dealer: "east", roundWind: "east" },
    hands: {
      east: { seat: "east", concealed: hand.map((id, i) => tile(id, `e-${i}`)), melds: [], revealedBonus: [] },
      south: { seat: "south", concealed: [], melds: [], revealedBonus: [] },
      west: { seat: "west", concealed: [], melds: [], revealedBonus: [] },
      north: { seat: "north", concealed: [], melds: [], revealedBonus: [] },
    },
  };
}

section("win rate tenpai");

const tenpai: TileId[] = [
  "wan-1", "wan-2", "wan-3",
  "wan-4", "wan-5", "wan-6",
  "wan-7", "wan-8",
  "bing-1", "bing-1", "bing-1",
  "bing-2", "bing-2",
];

const view = minimalView(tenpai, 40);
const tracker = TileTracker.fromView(view, "east");
const counts = countsFromIds(tenpai);
const rate = estimateWinRate(tracker, counts, 0);

assertGt("tenpai has P(win draw)", rate.probTenpai, 0);
assertGt("win rate score positive", winRateScore(rate), 0);

section("win rate far hand");

const messy: TileId[] = [
  "wan-1", "wan-9", "tiao-3", "bing-7", "east", "south", "red", "white",
  "wan-2", "wan-4", "tiao-9", "bing-2", "north",
];

const messyView = minimalView(messy, 10);
const messyTracker = TileTracker.fromView(messyView, "east");
const messyRate = estimateWinRate(messyTracker, countsFromIds(messy), 0);

assertLt("messy hand low tenpai prob", messyRate.probTenpai, rate.probTenpai);

console.log("\nAll win-rate tests passed");
