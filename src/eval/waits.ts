import { NUM_TILE_TYPES } from "../bitboard.js";
import { handShantenCounts } from "../shanten/index.js";
import { indexToTile } from "../tiles.js";
import type { TileId } from "../protocol.js";
import type { TileTracker } from "./tile-tracker.js";

export interface WaitInfo {
  /** Tile types that complete the hand (shanten → -1). */
  waits: TileId[];
  /** Remaining copies across all waits (ukeire at tenpai). */
  totalRemaining: number;
}

/**
 * Enumerate winning waits for a tenpai (or already-complete) hand.
 * Returns empty waits when shanten > 0.
 */
export function enumerateWaits(
  counts: Uint8Array,
  openMelds: number,
  tracker?: TileTracker,
): WaitInfo {
  const before = handShantenCounts(counts, openMelds).shanten;
  if (before > 0) return { waits: [], totalRemaining: 0 };

  const waits: TileId[] = [];
  let totalRemaining = 0;

  for (let idx = 0; idx < NUM_TILE_TYPES; idx++) {
    const left = tracker ? tracker.remainingAt(idx) : 4 - counts[idx];
    if (left <= 0 && tracker) continue;

    counts[idx]++;
    const after = handShantenCounts(counts, openMelds).shanten;
    counts[idx]--;

    if (after <= -1) {
      const id = indexToTile(idx);
      if (id) waits.push(id);
      totalRemaining += Math.max(0, left);
    }
  }

  return { waits, totalRemaining };
}

/** Soft bonus for wider waits when already in tenpai (0–1 scale inputs via caller). */
export function waitQualityScore(info: WaitInfo): number {
  if (info.waits.length === 0) return 0;
  return Math.min(6, info.totalRemaining) * 0.35 + Math.min(4, info.waits.length) * 0.15;
}
