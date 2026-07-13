import type { Meld, TileId } from "../protocol.js";
import type { HandShape } from "../shanten/index.js";
import { allMeldTiles, isHonorTile, isSuitedTile, parseSuitedTile } from "../tiles.js";

export type FlushKind = "none" | "half" | "full";

const HK_PATTERNS = {
  chicken: 0,
  allChows: 1,
  allPungs: 3,
  halfFlush: 3,
  fullFlush: 6,
} as const;

const TW_PATTERNS = {
  chicken: 1,
  allChows: 1,
  allPungs: 3,
  halfFlush: 3,
  fullFlush: 8,
} as const;

export function detectFlush(tiles: readonly TileId[]): FlushKind {
  const suited = tiles.filter(isSuitedTile);
  if (suited.length === 0) return "none";
  const suits = new Set(suited.map((t) => parseSuitedTile(t)!.suit));
  if (suits.size !== 1) return "none";
  return tiles.some(isHonorTile) ? "half" : "full";
}

function patternTable(rulesetId: "hong-kong" | "taiwanese") {
  return rulesetId === "taiwanese" ? TW_PATTERNS : HK_PATTERNS;
}

/** Best plausible fan/tai ceiling from current shape. */
export function estimateFanPotential(
  concealed: readonly TileId[],
  melds: readonly Meld[],
  rulesetId: "hong-kong" | "taiwanese",
  shape: HandShape = "standard",
): number {
  const patterns = patternTable(rulesetId);
  const meldTiles = allMeldTiles(melds);
  const allTiles = [...concealed, ...meldTiles];
  const flush = detectFlush(allTiles);
  const openMelds = melds.filter((m) => m.open).length;

  let ceiling: number = patterns.chicken;

  if (flush === "full") ceiling = Math.max(ceiling, patterns.fullFlush);
  else if (flush === "half") ceiling = Math.max(ceiling, patterns.halfFlush);
  else {
    const suited = allTiles.filter(isSuitedTile);
    if (suited.length >= 8) {
      const suits = new Set(suited.map((t) => parseSuitedTile(t)!.suit));
      if (suits.size === 1) ceiling = Math.max(ceiling, patterns.halfFlush * 0.6);
    }
  }

  const sets = melds;
  const allPungs = sets.length > 0 && sets.every((m) => m.kind === "pung" || m.kind === "kong");
  const allChows = sets.length > 0 && sets.every((m) => m.kind === "chow");

  if (allPungs) ceiling = Math.max(ceiling, patterns.allPungs);
  if (allChows && openMelds === 0) ceiling = Math.max(ceiling, patterns.allChows);

  // Open melds cap upside (lose concealed flexibility / all-chows path).
  if (openMelds > 0) ceiling = Math.min(ceiling, patterns.halfFlush);
  if (openMelds >= 2) ceiling = Math.min(ceiling, patterns.allPungs);

  if (openMelds === 0 && shape === "seven_pairs") {
    ceiling = Math.max(ceiling, rulesetId === "taiwanese" ? 3 : 3);
  }
  if (openMelds === 0 && shape === "thirteen_orphans") {
    ceiling = Math.max(ceiling, 13);
  }

  return ceiling * (1 - openMelds * 0.12);
}
