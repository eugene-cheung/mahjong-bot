import type { TileId } from "../protocol.js";
import { HandCounts } from "../bitboard.js";
import { countsFromIds } from "../tiles.js";
import { sevenPairsShanten } from "./seven-pairs.js";
import { standardShantenCounts } from "./standard.js";
import { thirteenOrphansShanten } from "./thirteen-orphans.js";

export type HandShape = "standard" | "seven_pairs" | "thirteen_orphans";

export interface ShantenResult {
  shanten: number;
  shape: HandShape;
}

export function handShantenCounts(counts: Uint8Array, openMelds: number): ShantenResult {
  const standard = standardShantenCounts(counts, openMelds);

  if (openMelds > 0) {
    return { shanten: standard, shape: "standard" };
  }

  const seven = sevenPairsShanten(counts);
  const orphans = thirteenOrphansShanten(counts);

  if (seven <= orphans && seven <= standard) {
    return { shanten: seven, shape: "seven_pairs" };
  }
  if (orphans <= standard) {
    return { shanten: orphans, shape: "thirteen_orphans" };
  }
  return { shanten: standard, shape: "standard" };
}

export function handShanten(concealed: readonly TileId[], openMelds: number): ShantenResult {
  return handShantenCounts(countsFromIds(concealed), openMelds);
}

export function handShantenFromHand(hand: HandCounts, openMelds: number): ShantenResult {
  return handShantenCounts(hand.counts, openMelds);
}

export { standardShantenCounts, sevenPairsShanten, thirteenOrphansShanten };
