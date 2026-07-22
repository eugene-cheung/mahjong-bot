/**
 * Opponent threat / genbutsu defense tests.
 */

import { discardDanger, isGenbutsu, maxOpponentThreat } from "../src/eval/opponent-threat.js";
import { assertGt, assertLt, assertTrue, section } from "./lib/test-helpers.js";
import type { GameState, TileId } from "../src/protocol.js";

function tile(id: TileId, instanceId: string) {
  return { instanceId, tileId: id };
}

function baseView(): GameState {
  return {
    phase: "turn_discard",
    rulesetId: "hong-kong",
    wall: { live: Array.from({ length: 40 }, (_, i) => tile("wan-1", `w${i}`)), dead: [] },
    discards: [],
    hands: {
      east: {
        seat: "east",
        concealed: [
          tile("wan-5", "a"),
          tile("bing-5", "b"),
          tile("tiao-5", "c"),
          tile("east", "d"),
          tile("wan-2", "e"),
          tile("wan-3", "f"),
          tile("wan-4", "g"),
          tile("wan-6", "h"),
          tile("wan-7", "i"),
          tile("wan-8", "j"),
          tile("red", "k"),
          tile("white", "l"),
          tile("green", "m"),
        ],
        melds: [],
        revealedBonus: [],
      },
      south: {
        seat: "south",
        concealed: [],
        melds: [
          { kind: "pung", tiles: ["tiao-2", "tiao-2", "tiao-2"], open: true },
          { kind: "pung", tiles: ["bing-2", "bing-2", "bing-2"], open: true },
        ],
        revealedBonus: [],
      },
      west: { seat: "west", concealed: [], melds: [], revealedBonus: [] },
      north: { seat: "north", concealed: [], melds: [], revealedBonus: [] },
    },
  };
}

section("genbutsu reduces danger");

const view = baseView();
view.discards = [
  { seat: "south", tile: tile("wan-5", "d1") },
  { seat: "south", tile: tile("east", "d2") },
  { seat: "south", tile: tile("white", "d3") },
  { seat: "south", tile: tile("green", "d4") },
];

assertTrue("wan-5 is genbutsu vs south", isGenbutsu(view, "south", "wan-5"));
assertTrue("threat detected", maxOpponentThreat(view, "east") > 0.4);

const genDanger = discardDanger(view, "east", "wan-5", false);
const hotDanger = discardDanger(view, "east", "bing-5", false);
assertLt("genbutsu safer than live middle", genDanger, hotDanger);

section("exhausted is safest");

assertEqSafe(discardDanger(view, "east", "wan-5", true), 0);

function assertEqSafe(got: number, expected: number): void {
  if (got !== expected) {
    console.error(`FAIL exhausted danger: got ${got}, expected ${expected}`);
    process.exit(1);
  }
  console.log("OK exhausted tile danger is 0");
}

assertGt("live middle still dangerous", hotDanger, 0.2);

console.log("\nAll opponent-threat tests passed");
