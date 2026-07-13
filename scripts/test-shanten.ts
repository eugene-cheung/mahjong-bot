/**
 * Standard-hand shanten regression tests.
 */

import { handShanten, standardShanten } from "../src/shanten.js";
import type { TileId } from "../src/protocol.js";
import { assertEq, assertGte, section } from "./lib/test-helpers.js";

section("shanten basics");

const complete: TileId[] = [
  "wan-1", "wan-2", "wan-3",
  "wan-4", "wan-5", "wan-6",
  "wan-7", "wan-8", "wan-9",
  "bing-1", "bing-1", "bing-1",
  "bing-2", "bing-2",
];

const tenpai: TileId[] = [
  "wan-1", "wan-2", "wan-3",
  "wan-4", "wan-5", "wan-6",
  "wan-7", "wan-8",
  "bing-1", "bing-1", "bing-1",
  "bing-2", "bing-2",
];

assertEq("complete hand is winning (-1)", standardShanten(complete, 0), -1);
assertEq("tenpai is shanten 0", standardShanten(tenpai, 0), 0);

section("shanten with open melds");

const concealedWithMeld: TileId[] = [
  "wan-1", "wan-2", "wan-3",
  "wan-4", "wan-5", "wan-6",
  "wan-7", "wan-8",
  "bing-2", "bing-2",
];

assertEq("one open meld + tenpai shape", standardShanten(concealedWithMeld, 1), 0);

const messy: TileId[] = [
  "wan-1", "wan-9", "tiao-3", "bing-7", "east", "south", "red", "white",
  "wan-2", "wan-4", "tiao-9", "bing-2", "north",
];

assertGte("messy hand is far from win", standardShanten(messy, 0), 3);

section("shanten pair-heavy");

const pairStart: TileId[] = [
  "wan-1", "wan-1", "wan-3", "wan-3", "wan-5", "wan-5",
  "bing-2", "bing-2", "tiao-4", "tiao-4", "east", "east", "red",
];

assertGte("many pairs still needs work (standard)", standardShanten(pairStart, 0), 1);
const unifiedPairs = handShanten(pairStart, 0);
assertEq("unified detects seven-pairs tenpai", unifiedPairs.shape, "seven_pairs");
assertEq("seven-pairs line is shanten 0", unifiedPairs.shanten, 0);

console.log("\nAll shanten tests passed");
