/**
 * Tile tracker regression tests.
 */

import { TileTracker, usefulDrawScore } from "../src/eval/tile-tracker.js";
import type { GameState, Seat, TileId } from "../src/protocol.js";
import { countsFromIds } from "../src/tiles.js";
import { assertEq, assertTrue, section } from "./lib/test-helpers.js";

function tile(id: TileId, instanceId: string) {
  return { instanceId, tileId: id };
}

function emptyHand(seat: Seat) {
  return { seat, concealed: [], melds: [], revealedBonus: [] };
}

function baseView(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "turn_discard",
    rulesetId: "hong-kong",
    handIndex: 3,
    scores: { east: 10, south: -5, west: 0, north: -5 },
    wall: { live: Array.from({ length: 42 }, (_, i) => tile("wan-1", `w-${i}`)), dead: [] },
    discards: [],
    dealer: { dealer: "east", roundWind: "east" },
    hands: {
      east: emptyHand("east"),
      south: emptyHand("south"),
      west: emptyHand("west"),
      north: emptyHand("north"),
    },
    ...overrides,
  };
}

section("exhausted tiles");

const exhaustedView = baseView({
  discards: [
    { seat: "south", tile: tile("wan-5", "d1") },
    { seat: "south", tile: tile("wan-5", "d2") },
    { seat: "west", tile: tile("wan-5", "d3") },
    { seat: "north", tile: tile("wan-5", "d4") },
  ],
  hands: {
    ...baseView().hands,
    east: { seat: "east", concealed: [tile("wan-1", "c1")], melds: [], revealedBonus: [] },
  },
});

const t1 = TileTracker.fromView(exhaustedView, "east");
assertTrue("four wan-5 visible → exhausted", t1.isExhausted("wan-5"));
assertEq("wan-1 one in hand → 3 remain", t1.remaining("wan-1"), 3);
assertEq("wall size", t1.wallRemaining, 42);

section("melds and discards counted");

const meldView = baseView({
  discards: [{ seat: "south", tile: tile("bing-3", "d1") }],
  hands: {
    east: {
      seat: "east",
      concealed: [tile("wan-2", "c1"), tile("wan-2", "c2")],
      melds: [{ kind: "pung", tiles: ["tiao-4", "tiao-4", "tiao-4"], open: true }],
      revealedBonus: [],
    },
    south: emptyHand("south"),
    west: emptyHand("west"),
    north: emptyHand("north"),
  },
});

const t2 = TileTracker.fromView(meldView, "east");
assertEq("pung removes 3 tiao-4", t2.remaining("tiao-4"), 1);
assertEq("discard removes 1 bing-3", t2.remaining("bing-3"), 3);
assertEq("concealed pair removes 2 wan-2", t2.remaining("wan-2"), 2);

section("probDraw and total unknown");

assertEq("probDraw wan-2", t2.probDraw("wan-2"), 2 / 42);
assertEq("probDraw exhausted", t1.probDraw("wan-5"), 0);
assertEq("total unknown copies", t2.totalUnknownCopies(), 34 * 4 - 3 - 1 - 2); // minus meld, discard, hand

section("usefulDrawScore");

const handCounts = countsFromIds(["wan-2", "wan-3", "wan-4"]);
const drawScore = usefulDrawScore(t2, handCounts);
assertTrue("sequence hand gets positive draw score", drawScore > 0);

const emptyWall = new TileTracker(t2.visible, 0);
assertEq("empty wall → zero draw score", usefulDrawScore(emptyWall, handCounts), 0);

section("opponent concealed hidden");

const hiddenView = baseView({
  hands: {
    east: { seat: "east", concealed: [tile("wan-9", "c1")], melds: [], revealedBonus: [] },
    south: {
      seat: "south",
      concealed: [tile("wan-9", "hidden-0"), tile("wan-9", "hidden-1")],
      melds: [],
      revealedBonus: [],
    },
    west: emptyHand("west"),
    north: emptyHand("north"),
  },
});

const t3 = TileTracker.fromView(hiddenView, "east");
assertEq("opponent concealed not counted in visible", t3.remaining("wan-9"), 3);

console.log("\nAll tile-tracker tests passed");
