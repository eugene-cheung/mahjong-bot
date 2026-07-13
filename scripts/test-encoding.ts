/**
 * State encoding tests for self-play v2.
 */

import { b64decode, b64encode, encodeState, relativeSeat } from "../src/self-play/encoding.js";
import type { GameState, TileId } from "../src/protocol.js";
import { assertEq, assertTrue, section } from "./lib/test-helpers.js";

function tile(id: TileId, instanceId: string) {
  return { instanceId, tileId: id };
}

function minimalView(): GameState {
  return {
    phase: "turn_discard",
    rulesetId: "hong-kong",
    handIndex: 1,
    scores: { east: 10, south: -2, west: -4, north: -4 },
    wall: { live: Array.from({ length: 60 }, (_, i) => tile("wan-1", `w-${i}`)), dead: [] },
    discards: [
      { seat: "south", tile: tile("wan-5", "d1") },
      { seat: "east", tile: tile("tiao-3", "d2") },
    ],
    dealer: { dealer: "east", roundWind: "east" },
    hands: {
      east: {
        seat: "east",
        concealed: [
          tile("wan-1", "1"),
          tile("wan-2", "2"),
          tile("wan-3", "3"),
          tile("bing-1", "4"),
          tile("bing-1", "5"),
          tile("east", "6"),
          tile("red", "7"),
          tile("wan-4", "8"),
          tile("wan-6", "9"),
          tile("wan-7", "10"),
          tile("wan-8", "11"),
          tile("wan-9", "12"),
          tile("tiao-1", "13"),
        ],
        melds: [],
        revealedBonus: [],
      },
      south: {
        seat: "south",
        concealed: [],
        melds: [{ kind: "pung", tiles: ["tiao-5", "tiao-5", "tiao-5"], open: true }],
        revealedBonus: [],
      },
      west: { seat: "west", concealed: [], melds: [], revealedBonus: [] },
      north: { seat: "north", concealed: [], melds: [], revealedBonus: [] },
    },
  };
}

section("base64 roundtrip");

const counts = new Uint8Array(34);
counts[0] = 2;
counts[27] = 1;
const encoded = b64encode(counts);
const decoded = b64decode(encoded);
assertEq("b64 roundtrip len", decoded.length, 34);
assertEq("b64 roundtrip wan-1", decoded[0], 2);

section("relative seat");

assertEq("east self", relativeSeat("east", "east"), 0);
assertEq("east right is south", relativeSeat("east", "south"), 1);
assertEq("south left is east", relativeSeat("south", "east"), 3);

section("encode state");

const state = encodeState(minimalView(), "east");
assertEq("hand b64 decodes", b64decode(state.hand)[0], 1);
assertEq("wall scalar", state.scalars[0], 60);
assertEq("self score scalar", state.scalars[2], 10);
assertTrue("meld encoded", state.melds.length >= 1);

console.log("\nAll encoding tests passed");
