/**
 * HandCounts / bitboard tests.
 */

import { HandCounts } from "../src/bitboard.js";
import type { TileId } from "../src/protocol.js";
import { assertEq, section } from "./lib/test-helpers.js";

section("HandCounts basics");

const ids: TileId[] = ["wan-1", "wan-1", "wan-2", "east", "east"];
const hand = HandCounts.fromIds(ids);

assertEq("total tiles", hand.total(), 5);
assertEq("wan-1 count", hand.counts[0], 2);
assertEq("wan-2 count", hand.counts[1], 1);
assertEq("east count", hand.counts[27], 2);

section("HandCounts mutate");

const clone = hand.clone();
clone.removeIndex(0);
assertEq("clone independent", hand.counts[0], 2);
assertEq("removed from clone", clone.counts[0], 1);

hand.addTile("wan-3");
assertEq("add tile", hand.counts[2], 1);

console.log("\nAll bitboard tests passed");
