import type { GameState, Seat, TileId } from "../protocol.js";
import { SEATS } from "../protocol.js";
import { NUM_TILE_TYPES } from "../bitboard.js";
import { handShantenCounts } from "../shanten/index.js";
import { countsFromIds, MAX_COPIES, tileToIndex } from "../tiles.js";
import type { ClaimContext, EncodedState } from "./records.js";

const PHASE_CODE: Record<string, number> = {
  turn_draw: 0,
  turn_discard: 1,
  claim_window: 2,
};

const MELD_KIND: Record<string, number> = { chow: 0, pung: 1, kong: 2 };

/** Absolute seat → 0=self, 1=right, 2=across, 3=left from botSeat's perspective. */
export function relativeSeat(botSeat: Seat, seat: Seat): number {
  return (SEATS.indexOf(seat) - SEATS.indexOf(botSeat) + 4) % 4;
}

export function seatIndex(seat: Seat): number {
  return SEATS.indexOf(seat);
}

export function indexToSeat(index: number): Seat {
  return SEATS[index]!;
}

/** base64 encode/decode for Uint8Array(34) without Node Buffer dependency. */

function bytesToBinary(counts: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < counts.length; i++) binary += String.fromCharCode(counts[i]!);
  return binary;
}

function binaryToBytes(binary: string): Uint8Array {
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function btoaPoly(binary: string): string {
  let out = "";
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < binary.length ? B64[(n >> 6) & 63]! : "=") + (i + 2 < binary.length ? B64[n & 63]! : "=");
  }
  return out;
}

function atobPoly(encoded: string): string {
  const clean = encoded.replace(/=+$/, "");
  let binary = "";
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]!);
    const b = B64.indexOf(clean[i + 1]!);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]!) : 0;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]!) : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    binary += String.fromCharCode((n >> 16) & 255);
    if (i + 2 < clean.length) binary += String.fromCharCode((n >> 8) & 255);
    if (i + 3 < clean.length) binary += String.fromCharCode(n & 255);
  }
  return binary;
}

export function b64encode(counts: Uint8Array): string {
  return btoaPoly(bytesToBinary(counts));
}

export function b64decode(encoded: string): Uint8Array {
  return binaryToBytes(atobPoly(encoded));
}

function discardCountsForSeat(view: GameState, target: Seat): Uint8Array {
  const counts = new Uint8Array(NUM_TILE_TYPES);
  for (const entry of view.discards ?? []) {
    if (entry.seat !== target) continue;
    const idx = tileToIndex(entry.tile.tileId);
    if (idx >= 0) counts[idx]++;
  }
  return counts;
}

function remainingCounts(view: GameState, botSeat: Seat): Uint8Array {
  const visible = new Uint8Array(NUM_TILE_TYPES);
  for (const seat of SEATS) {
    const hand = view.hands[seat];
    if (seat === botSeat) {
      for (const t of hand.concealed) {
        const idx = tileToIndex(t.tileId);
        if (idx >= 0) visible[idx]++;
      }
    }
    for (const meld of hand.melds) {
      for (const id of meld.tiles) {
        const idx = tileToIndex(id);
        if (idx >= 0) visible[idx]++;
      }
    }
  }
  for (const entry of view.discards ?? []) {
    const idx = tileToIndex(entry.tile.tileId);
    if (idx >= 0) visible[idx]++;
  }
  const remaining = new Uint8Array(NUM_TILE_TYPES);
  for (let i = 0; i < NUM_TILE_TYPES; i++) {
    remaining[i] = Math.max(0, MAX_COPIES - visible[i]);
  }
  return remaining;
}

function exhaustedMask(remaining: Uint8Array): Uint8Array {
  const mask = new Uint8Array(NUM_TILE_TYPES);
  for (let i = 0; i < NUM_TILE_TYPES; i++) mask[i] = remaining[i] === 0 ? 1 : 0;
  return mask;
}

function encodeMelds(view: GameState, botSeat: Seat): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (const seat of SEATS) {
    for (const meld of view.hands[seat].melds) {
      const rel = relativeSeat(botSeat, seat);
      const kind = MELD_KIND[meld.kind] ?? 0;
      const tileIdx = tileToIndex(meld.tiles[0] ?? "wan-1");
      out.push([rel, kind, tileIdx >= 0 ? tileIdx : 0, meld.open ? 1 : 0]);
    }
  }
  return out;
}

function dealerRelative(view: GameState, botSeat: Seat): number {
  const dealer = view.dealer?.dealer;
  if (!dealer) return 0;
  return relativeSeat(botSeat, dealer);
}

function openMeldStats(view: GameState, botSeat: Seat): { self: number; maxOpp: number } {
  const self = view.hands[botSeat].melds.filter((m) => m.open).length;
  let maxOpp = 0;
  for (const seat of SEATS) {
    if (seat === botSeat) continue;
    maxOpp = Math.max(maxOpp, view.hands[seat].melds.filter((m) => m.open).length);
  }
  return { self, maxOpp };
}

export function encodeState(view: GameState, botSeat: Seat): EncodedState {
  const concealed = view.hands[botSeat].concealed.map((t) => t.tileId);
  const handCounts = countsFromIds(concealed);
  const sh = handShantenCounts(handCounts, view.hands[botSeat].melds.length);
  const remaining = remainingCounts(view, botSeat);
  const exhausted = exhaustedMask(remaining);
  const scores = view.scores ?? { east: 0, south: 0, west: 0, north: 0 };
  const { self: openSelf, maxOpp: openMaxOpp } = openMeldStats(view, botSeat);

  const relScore = (seat: Seat) => scores[seat];
  const right = SEATS[(SEATS.indexOf(botSeat) + 1) % 4]!;
  const across = SEATS[(SEATS.indexOf(botSeat) + 2) % 4]!;
  const left = SEATS[(SEATS.indexOf(botSeat) + 3) % 4]!;

  return {
    hand: b64encode(handCounts),
    discards: [
      b64encode(discardCountsForSeat(view, botSeat)),
      b64encode(discardCountsForSeat(view, right)),
      b64encode(discardCountsForSeat(view, across)),
      b64encode(discardCountsForSeat(view, left)),
    ],
    melds: encodeMelds(view, botSeat),
    remaining: b64encode(remaining),
    exhausted: b64encode(exhausted),
    scalars: [
      view.wall?.live.length ?? 0,
      sh.shanten,
      relScore(botSeat),
      relScore(right),
      relScore(across),
      relScore(left),
      dealerRelative(view, botSeat),
      PHASE_CODE[view.phase] ?? 3,
      openSelf,
      openMaxOpp,
    ],
  };
}

export function encodeClaimContext(view: GameState, botSeat: Seat): ClaimContext | undefined {
  if (view.phase !== "claim_window") return undefined;
  const discards = view.discards ?? [];
  if (discards.length === 0) return undefined;
  const last = discards[discards.length - 1]!;
  const tile = tileToIndex(last.tile.tileId);
  if (tile < 0) return undefined;
  return { from: relativeSeat(botSeat, last.seat), tile };
}

export function tileIdToIndex(id: TileId): number {
  return tileToIndex(id);
}
