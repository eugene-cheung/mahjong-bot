import type { GameState, Seat } from "../protocol.js";
import { SEATS } from "../protocol.js";

/** Normalized 0–1 threat that an opponent is close to winning. */
export function maxOpponentThreat(view: GameState, botSeat: Seat): number {
  let max = 0;
  for (const seat of SEATS) {
    if (seat === botSeat) continue;
    max = Math.max(max, seatThreat(view, seat));
  }
  return max;
}

function seatThreat(view: GameState, seat: Seat): number {
  const hand = view.hands[seat];
  const meldCount = hand.melds.length;
  const discards = (view.discards ?? []).filter((d) => d.seat === seat).length;

  let threat = meldCount * 0.22;
  if (meldCount >= 2) threat += 0.35;
  if (meldCount >= 3) threat += 0.25;
  if (discards >= 6 && meldCount >= 1) threat += 0.15;

  // Late safe-looking discards (honors / terminals) suggest tenpai defense.
  const recent = (view.discards ?? []).filter((d) => d.seat === seat).slice(-4);
  const safeLate = recent.filter((d) => {
    const id = d.tile.tileId;
    return isHonorOrTerminal(id);
  }).length;
  if (safeLate >= 3 && meldCount >= 2) threat += 0.2;

  return Math.min(1, threat);
}

function isHonorOrTerminal(id: string): boolean {
  if (["east", "south", "west", "north", "red", "green", "white"].includes(id)) return true;
  const parts = id.split("-");
  if (parts.length !== 2) return false;
  const rank = Number(parts[1]);
  return rank === 1 || rank === 9;
}

/** P(deal-in) proxy for discarding tileId (0 = safe, 1 = very dangerous). */
export function discardDanger(view: GameState, botSeat: Seat, tileId: string, exhausted: boolean): number {
  if (exhausted) return 0;
  const threat = maxOpponentThreat(view, botSeat);
  if (threat <= 0.1) return 0.05;

  let danger = threat * 0.4;

  // Tile fits a suit an opponent never discarded — likely kept for a flush/wait.
  for (const seat of SEATS) {
    if (seat === botSeat) continue;
    const theirDiscards = (view.discards ?? []).filter((d) => d.seat === seat).map((d) => d.tile.tileId);
    if (theirDiscards.length < 4) continue;
    const tileSuit = tileId.split("-")[0];
    if (!tileSuit || !["wan", "tiao", "bing"].includes(tileSuit)) continue;
    const dumpedSuit = theirDiscards.some((d) => d.startsWith(tileSuit + "-"));
    if (!dumpedSuit && view.hands[seat].melds.length >= 1) {
      danger += 0.25;
    }
  }

  return Math.min(1, danger);
}
