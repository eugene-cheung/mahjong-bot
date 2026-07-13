import { ORPHAN_INDICES } from "../bitboard.js";

/** Thirteen orphans shanten — concealed only. */

export function thirteenOrphansShanten(counts: Uint8Array): number {
  let have = 0;
  let pair = false;
  for (const idx of ORPHAN_INDICES) {
    const n = counts[idx];
    if (n >= 1) have++;
    if (n >= 2) pair = true;
  }
  return 13 - have - (pair ? 1 : 0);
}
