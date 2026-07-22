import type { Meld, Seat, TileId } from "../protocol.js";
import { SEATS } from "../protocol.js";
import type { HandShape } from "../shanten/index.js";
import { allMeldTiles, isHonorTile, isSuitedTile, parseSuitedTile } from "../tiles.js";

export type FlushKind = "none" | "half" | "full";

export interface FanContext {
  seat?: Seat;
  dealer?: Seat;
  roundWind?: TileId;
  revealedBonus?: readonly TileId[];
}

const HK_PATTERNS = {
  chicken: 0,
  allChows: 1,
  allPungs: 3,
  sevenPairs: 3,
  halfFlush: 3,
  fullFlush: 6,
  thirteenOrphans: 13,
} as const;

const TW_PATTERNS = {
  chicken: 1,
  allChows: 1,
  allPungs: 3,
  sevenPairs: 3,
  halfFlush: 3,
  fullFlush: 8,
  thirteenOrphans: 13,
} as const;

const HK_BONUS = {
  dragonPung: 1,
  seatWindPung: 1,
  roundWindPung: 1,
  concealedHand: 1,
  seatFlower: 1,
} as const;

const TW_BONUS = {
  dragonPung: 1,
  seatWindPung: 1,
  roundWindPung: 1,
  concealedHand: 0,
  seatFlower: 1,
} as const;

const DRAGONS: ReadonlySet<TileId> = new Set(["red", "green", "white"]);

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

function bonusTable(rulesetId: "hong-kong" | "taiwanese") {
  return rulesetId === "taiwanese" ? TW_BONUS : HK_BONUS;
}

/** Seat wind relative to dealer (dealer = east wind). */
export function seatWindFor(seat: Seat, dealer: Seat): TileId {
  const seatIdx = SEATS.indexOf(seat);
  const dealerIdx = SEATS.indexOf(dealer);
  return SEATS[(seatIdx - dealerIdx + 4) % 4]!;
}

function meldIsPungOrKongOf(meld: Meld, tileId: TileId): boolean {
  return (meld.kind === "pung" || meld.kind === "kong") && meld.tiles[0] === tileId;
}

function countPungBonus(
  melds: readonly Meld[],
  concealed: readonly TileId[],
  tileId: TileId,
): number {
  if (melds.some((m) => meldIsPungOrKongOf(m, tileId))) return 1;
  const n = concealed.filter((t) => t === tileId).length;
  return n >= 3 ? 0.7 : n === 2 ? 0.25 : 0;
}

/** Best plausible fan/tai ceiling from current shape. */
export function estimateFanPotential(
  concealed: readonly TileId[],
  melds: readonly Meld[],
  rulesetId: "hong-kong" | "taiwanese",
  shape: HandShape = "standard",
  ctx: FanContext = {},
): number {
  const patterns = patternTable(rulesetId);
  const bonuses = bonusTable(rulesetId);
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

  // Stackable value tiles / winds (partial credit for pairs progressing to pung).
  let bonus = 0;
  for (const dragon of DRAGONS) {
    bonus += bonuses.dragonPung * countPungBonus(melds, concealed, dragon);
  }
  if (ctx.seat && ctx.dealer) {
    const seatWind = seatWindFor(ctx.seat, ctx.dealer);
    bonus += bonuses.seatWindPung * countPungBonus(melds, concealed, seatWind);
  }
  if (ctx.roundWind && (ctx.roundWind === "east" || ctx.roundWind === "south" || ctx.roundWind === "west" || ctx.roundWind === "north")) {
    bonus += bonuses.roundWindPung * countPungBonus(melds, concealed, ctx.roundWind);
  }
  if (openMelds === 0) bonus += bonuses.concealedHand * 0.5;
  if (ctx.revealedBonus && ctx.revealedBonus.length > 0) {
    bonus += Math.min(2, ctx.revealedBonus.length * bonuses.seatFlower * 0.35);
  }

  ceiling += bonus;

  // Open melds cap upside (lose concealed flexibility / all-chows path).
  if (openMelds > 0) ceiling = Math.min(ceiling, patterns.halfFlush + bonus);
  if (openMelds >= 2) ceiling = Math.min(ceiling, patterns.allPungs + bonus);

  if (openMelds === 0 && shape === "seven_pairs") {
    ceiling = Math.max(ceiling, patterns.sevenPairs);
  }
  if (openMelds === 0 && shape === "thirteen_orphans") {
    ceiling = Math.max(ceiling, patterns.thirteenOrphans);
  }

  return ceiling * (1 - openMelds * 0.12);
}
