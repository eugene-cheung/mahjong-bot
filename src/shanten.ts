/**
 * Shanten entry — re-exports unified hand evaluation.
 */

import type { TileId } from "./protocol.js";
import { countsFromIds } from "./tiles.js";
import { standardShantenCounts } from "./shanten/index.js";

export type { HandShape, ShantenResult } from "./shanten/index.js";
export {
  handShanten,
  handShantenCounts,
  handShantenFromHand,
  standardShantenCounts,
  sevenPairsShanten,
  thirteenOrphansShanten,
} from "./shanten/index.js";

/** Standard 4-sets + pair shanten only (excludes seven pairs / orphans). */
export function standardShanten(concealed: readonly TileId[], openMelds: number): number {
  return standardShantenCounts(countsFromIds(concealed), openMelds);
}
