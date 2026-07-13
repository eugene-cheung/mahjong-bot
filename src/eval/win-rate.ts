import { NUM_TILE_TYPES } from "../bitboard.js";
import { handShantenCounts, type ShantenResult } from "../shanten/index.js";
import type { TileTracker } from "./tile-tracker.js";

export interface WinRateEstimate {
  /** P(next draw reaches tenpai or better). */
  probTenpai: number;
  /** P(next draw strictly improves shanten). */
  probImprove: number;
  /** Expected shanten after one random draw (lower is better). */
  expectedShanten: number;
}

export function estimateWinRate(
  tracker: TileTracker,
  counts: Uint8Array,
  openMelds: number,
): WinRateEstimate {
  if (tracker.wallRemaining <= 0) {
    return { probTenpai: 0, probImprove: 0, expectedShanten: handShantenCounts(counts, openMelds).shanten };
  }

  const before = handShantenCounts(counts, openMelds).shanten;
  let tenpaiWeight = 0;
  let improveWeight = 0;
  let shantenSum = 0;

  for (let idx = 0; idx < NUM_TILE_TYPES; idx++) {
    const left = tracker.remainingAt(idx);
    if (left <= 0) continue;

    counts[idx]++;
    const after = handShantenCounts(counts, openMelds);
    counts[idx]--;

    if (after.shanten <= 0) tenpaiWeight += left;
    if (after.shanten < before) improveWeight += left;
    shantenSum += after.shanten * left;
  }

  const wall = tracker.wallRemaining;
  return {
    probTenpai: tenpaiWeight / wall,
    probImprove: improveWeight / wall,
    expectedShanten: shantenSum / wall,
  };
}

export function winRateScore(estimate: WinRateEstimate): number {
  return estimate.probTenpai * 4 + estimate.probImprove * 2 - estimate.expectedShanten * 0.25;
}

export function compareShanten(a: ShantenResult, b: ShantenResult): number {
  if (a.shanten !== b.shanten) return a.shanten - b.shanten;
  return 0;
}
