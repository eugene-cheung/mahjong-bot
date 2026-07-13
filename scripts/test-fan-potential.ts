/**
 * Fan potential heuristic tests.
 */

import { detectFlush, estimateFanPotential } from "../src/eval/fan-potential.js";
import type { Meld, TileId } from "../src/protocol.js";
import { assertEq, assertGte, assertLt, section } from "./lib/test-helpers.js";

section("flush detection");

const fullFlush: TileId[] = ["wan-1", "wan-2", "wan-3", "wan-4", "wan-5", "wan-6"];
assertEq("full flush", detectFlush(fullFlush), "full");

const halfFlush: TileId[] = ["wan-1", "wan-2", "wan-3", "east", "south"];
assertEq("half flush", detectFlush(halfFlush), "half");

const mixed: TileId[] = ["wan-1", "tiao-2", "bing-3"];
assertEq("no flush", detectFlush(mixed), "none");

section("HK fan ceiling");

const openPung: Meld[] = [{ kind: "pung", tiles: ["bing-5", "bing-5", "bing-5"], open: true }];
const flushConcealed: TileId[] = [
  "wan-1", "wan-2", "wan-3", "wan-4", "wan-5", "wan-6", "wan-7", "wan-8", "wan-9", "wan-2",
];

assertGte("full flush shape scores high", estimateFanPotential(flushConcealed, [], "hong-kong"), 5);

const chicken: TileId[] = ["wan-1", "wan-3", "tiao-5", "bing-7", "east", "south", "red", "white"];
assertLt("mixed chicken low ceiling", estimateFanPotential(chicken, [], "hong-kong"), 2);

assertLt(
  "open meld caps ceiling vs concealed flush",
  estimateFanPotential(flushConcealed, openPung, "hong-kong"),
  estimateFanPotential(flushConcealed, [], "hong-kong"),
);

section("TW uses higher full flush table");

const twFull = estimateFanPotential(flushConcealed, [], "taiwanese");
const hkFull = estimateFanPotential(flushConcealed, [], "hong-kong");
assertGte("TW full flush > HK", twFull, hkFull);

console.log("\nAll fan-potential tests passed");
