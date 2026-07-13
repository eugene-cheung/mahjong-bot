/**
 * Seven pairs + thirteen orphans shanten tests.
 */

import {
  handShanten,
  sevenPairsShanten,
  thirteenOrphansShanten,
} from "../src/shanten/index.js";
import { countsFromIds } from "../src/tiles.js";
import type { TileId } from "../src/protocol.js";
import { assertEq, section } from "./lib/test-helpers.js";

section("seven pairs");

const sevenPairShape: TileId[] = [
  "wan-1", "wan-1", "wan-3", "wan-3", "wan-5", "wan-5",
  "bing-2", "bing-2", "tiao-4", "tiao-4", "east", "east", "red",
];

assertEq("seven pairs tenpai", sevenPairsShanten(countsFromIds(sevenPairShape)), 0);

const sevenPairWin: TileId[] = [...sevenPairShape, "red"];
assertEq("seven pairs complete", sevenPairsShanten(countsFromIds(sevenPairWin)), -1);

section("thirteen orphans");

const orphanShape: TileId[] = [
  "wan-1", "wan-9", "tiao-1", "tiao-9", "bing-1", "bing-9",
  "east", "south", "west", "north", "red", "green", "white",
];

assertEq("orphans tenpai", thirteenOrphansShanten(countsFromIds(orphanShape)), 0);

const orphanWin: TileId[] = [...orphanShape, "wan-1"];
assertEq("orphans complete", thirteenOrphansShanten(countsFromIds(orphanWin)), -1);

section("unified handShanten");

const unified = handShanten(sevenPairShape, 0);
assertEq("unified picks seven pairs", unified.shape, "seven_pairs");
assertEq("unified seven pairs shanten", unified.shanten, 0);

const orphanUnified = handShanten(orphanShape, 0);
assertEq("unified picks orphans", orphanUnified.shape, "thirteen_orphans");

const withOpen = handShanten(sevenPairShape, 1);
assertEq("open melds force standard", withOpen.shape, "standard");

console.log("\nAll special shanten tests passed");
