/**
 * Fast 34-type hand representation for shanten, win-rate, and rollouts.
 */

import type { TileId } from "./protocol.js";
import { MAX_COPIES, tileToIndex } from "./tiles.js";

export const NUM_TILE_TYPES = 34;

/** Terminal + honor indices for thirteen orphans. */
export const ORPHAN_INDICES: readonly number[] = [
  0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33,
];

export class HandCounts {
  readonly counts: Uint8Array;

  constructor(counts?: Uint8Array) {
    this.counts = counts ?? new Uint8Array(NUM_TILE_TYPES);
  }

  static fromIds(ids: readonly TileId[]): HandCounts {
    const counts = new Uint8Array(NUM_TILE_TYPES);
    for (const id of ids) {
      const idx = tileToIndex(id);
      if (idx >= 0) counts[idx]++;
    }
    return new HandCounts(counts);
  }

  clone(): HandCounts {
    return new HandCounts(new Uint8Array(this.counts));
  }

  total(): number {
    let n = 0;
    for (let i = 0; i < NUM_TILE_TYPES; i++) n += this.counts[i];
    return n;
  }

  addIndex(index: number, amount = 1): boolean {
    if (index < 0 || index >= NUM_TILE_TYPES) return false;
    if (this.counts[index] + amount > MAX_COPIES) return false;
    this.counts[index] += amount;
    return true;
  }

  removeIndex(index: number, amount = 1): boolean {
    if (index < 0 || index >= NUM_TILE_TYPES) return false;
    if (this.counts[index] < amount) return false;
    this.counts[index] -= amount;
    return true;
  }

  addTile(id: TileId, amount = 1): boolean {
    const idx = tileToIndex(id);
    return idx >= 0 && this.addIndex(idx, amount);
  }

  removeTile(id: TileId, amount = 1): boolean {
    const idx = tileToIndex(id);
    return idx >= 0 && this.removeIndex(idx, amount);
  }
}
