import type { GameState, Seat, TileId } from "../protocol.js";
import { SEATS } from "../protocol.js";
import { incCount, MAX_COPIES, tileToIndex } from "../tiles.js";

/**
 * Tracks visible suited/honor tiles and estimates draw probabilities.
 * Uses Uint8Array(34) for fast counting (Phase 6–ready).
 */
export class TileTracker {
  /** Copies seen in hands, melds, and discards. */
  readonly visible: Uint8Array;
  /** Undrawn tiles in the live wall. */
  readonly wallRemaining: number;

  constructor(visible: Uint8Array, wallRemaining: number) {
    this.visible = visible;
    this.wallRemaining = wallRemaining;
  }

  static fromView(view: GameState, botSeat: Seat): TileTracker {
    const visible = new Uint8Array(34);

    for (const seat of SEATS) {
      const hand = view.hands[seat];
      if (seat === botSeat) {
        for (const t of hand.concealed) incCount(visible, t.tileId);
      }
      for (const meld of hand.melds) {
        for (const id of meld.tiles) incCount(visible, id);
      }
    }

    for (const entry of view.discards ?? []) {
      incCount(visible, entry.tile.tileId);
    }

    const wallRemaining = view.wall?.live.length ?? 0;
    return new TileTracker(visible, wallRemaining);
  }

  remaining(id: TileId): number {
    const idx = tileToIndex(id);
    if (idx < 0) return 0;
    return Math.max(0, MAX_COPIES - this.visible[idx]);
  }

  remainingAt(index: number): number {
    return Math.max(0, MAX_COPIES - this.visible[index]);
  }

  /** All four copies visible — no opponent can ron on this tile. */
  isExhausted(id: TileId): boolean {
    return this.remaining(id) <= 0;
  }

  /** P(next draw is this tile) ≈ remaining / wall size. */
  probDraw(id: TileId): number {
    const left = this.remaining(id);
    if (left <= 0 || this.wallRemaining <= 0) return 0;
    return left / this.wallRemaining;
  }

  totalUnknownCopies(): number {
    let sum = 0;
    for (let i = 0; i < 34; i++) sum += this.remainingAt(i);
    return sum;
  }
}

/** Weighted odds that the next draw helps a hand shaped like `handCounts`. */
export function usefulDrawScore(tracker: TileTracker, handCounts: Uint8Array): number {
  if (tracker.wallRemaining <= 0) return 0;
  let helpful = 0;
  for (let i = 0; i < 34; i++) {
    const left = tracker.remainingAt(i);
    if (left <= 0) continue;
    let relevance = handCounts[i] > 0 ? 2 : 0;
    if (i < 27) {
      const rank = i % 9;
      const base = i - rank;
      if (rank > 0 && handCounts[base + rank - 1] > 0) relevance += 1;
      if (rank < 8 && handCounts[base + rank + 1] > 0) relevance += 1;
      if (rank > 1 && handCounts[base + rank - 2] > 0) relevance += 0.5;
      if (rank < 7 && handCounts[base + rank + 2] > 0) relevance += 0.5;
    }
    helpful += left * relevance;
  }
  return helpful / tracker.wallRemaining;
}
