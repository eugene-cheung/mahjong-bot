import type { DecisionPrompt, GameState, LegalAction, Meld, Seat, TileId } from "../protocol.js";
import { estimateFanPotential } from "./fan-potential.js";
import { discardDanger, maxOpponentThreat } from "./opponent-threat.js";
import type { EvWeights } from "./profiles.js";
import { handShantenCounts } from "../shanten/index.js";
import { TileTracker, usefulDrawScore } from "./tile-tracker.js";
import { estimateWinRate, winRateScore } from "./win-rate.js";
import { enumerateWaits, waitQualityScore } from "./waits.js";
import { countsFromIds, allMeldTiles } from "../tiles.js";

const WIN_SCORE = 1_000_000;

export interface HandSnapshot {
  concealed: TileId[];
  melds: Meld[];
}

export function snapshotHand(view: GameState, seat: Seat): HandSnapshot {
  const hand = view.hands[seat];
  return {
    concealed: hand.concealed.map((t) => t.tileId),
    melds: hand.melds,
  };
}

function fanContext(view: GameState, seat: Seat) {
  return {
    seat,
    dealer: view.dealer?.dealer,
    roundWind: view.dealer?.roundWind,
    revealedBonus: view.hands[seat]?.revealedBonus,
  };
}

function evalHand(
  view: GameState,
  seat: Seat,
  snap: HandSnapshot,
  weights: EvWeights,
  tracker: TileTracker,
): number {
  const handCounts = countsFromIds(snap.concealed);
  const shResult = handShantenCounts(handCounts, snap.melds.length);
  const fan = estimateFanPotential(
    snap.concealed,
    snap.melds,
    view.rulesetId,
    shResult.shape,
    fanContext(view, seat),
  );
  const winRate = estimateWinRate(tracker, handCounts, snap.melds.length);
  const draw = usefulDrawScore(tracker, handCounts) * 0.35 + winRateScore(winRate) * 0.65;
  const threat = maxOpponentThreat(view, seat);
  const waits =
    shResult.shanten === 0 ? enumerateWaits(handCounts, snap.melds.length, tracker) : null;
  const waitBonus = waits ? weights.draw * waitQualityScore(waits) : 0;

  return (
    -weights.shanten * shResult.shanten +
    weights.fan * fan +
    weights.draw * draw +
    weights.winRate * winRateScore(winRate) +
    waitBonus -
    weights.danger * threat * 0.15
  );
}

function discardEv(
  view: GameState,
  seat: Seat,
  after: HandSnapshot,
  tileId: TileId,
  weights: EvWeights,
  tracker: TileTracker,
): number {
  const exhausted = tracker.isExhausted(tileId);
  const threat = maxOpponentThreat(view, seat);
  const danger = discardDanger(view, seat, tileId, exhausted);
  const safetyBonus = exhausted ? weights.danger * (2 + threat * 5) : 0;
  return (
    evalHand(view, seat, after, weights, tracker) -
    weights.danger * danger * (0.5 + threat) +
    safetyBonus
  );
}

/**
 * After pung/chow the hand still holds a tile that must be discarded.
 * Score the best forced discard (by tile type).
 */
export function bestPostClaimDiscardEv(
  view: GameState,
  seat: Seat,
  after: HandSnapshot,
  weights: EvWeights,
  tracker: TileTracker,
): number {
  if (after.concealed.length === 0) {
    return evalHand(view, seat, after, weights, tracker);
  }

  let best = -Infinity;
  const seen = new Set<TileId>();
  for (let i = 0; i < after.concealed.length; i++) {
    const tileId = after.concealed[i]!;
    if (seen.has(tileId)) continue;
    seen.add(tileId);
    const concealed = after.concealed.slice(0, i).concat(after.concealed.slice(i + 1));
    const snap: HandSnapshot = { concealed, melds: after.melds };
    best = Math.max(best, discardEv(view, seat, snap, tileId, weights, tracker));
  }
  return best;
}

function applyClaim(snap: HandSnapshot, claim: LegalAction): HandSnapshot | null {
  const concealed = [...snap.concealed];
  const melds = [...snap.melds];

  switch (claim.command.type) {
    case "hu":
    case "flower_win":
      return snap;
    case "pung": {
      const tileId = claim.command.tileId;
      let removed = 0;
      for (let i = concealed.length - 1; i >= 0 && removed < 2; i--) {
        if (concealed[i] === tileId) {
          concealed.splice(i, 1);
          removed++;
        }
      }
      if (removed < 2) return null;
      melds.push({ kind: "pung", tiles: [tileId, tileId, tileId], open: true, claimedTile: tileId });
      return { concealed, melds };
    }
    case "kong": {
      const tileId = claim.command.tileId;
      const inHand = concealed.filter((t) => t === tileId).length;

      // Add-kong: promote an open pung with the 4th tile from hand.
      if (!claim.command.concealed) {
        const pungIdx = melds.findIndex(
          (m) => m.kind === "pung" && m.open && m.tiles[0] === tileId,
        );
        if (pungIdx >= 0 && inHand >= 1) {
          const idx = concealed.indexOf(tileId);
          concealed.splice(idx, 1);
          melds[pungIdx] = {
            kind: "kong",
            tiles: [tileId, tileId, tileId, tileId],
            open: true,
            claimedTile: melds[pungIdx]!.claimedTile ?? tileId,
          };
          return { concealed, melds };
        }
      }

      // Rob-discard kong: 3 in hand + discard.
      // Concealed ankan: 4 in hand.
      const need = claim.command.concealed ? 4 : 3;
      if (inHand < need) return null;
      let removed = 0;
      for (let i = concealed.length - 1; i >= 0 && removed < need; i--) {
        if (concealed[i] === tileId) {
          concealed.splice(i, 1);
          removed++;
        }
      }
      melds.push({
        kind: "kong",
        tiles: [tileId, tileId, tileId, tileId],
        open: !claim.command.concealed,
        claimedTile: tileId,
      });
      return { concealed, melds };
    }
    case "chow": {
      const meld = claim.command.meld;
      const toRemove = [...meld.tiles];
      if (meld.claimedTile) {
        const claimIdx = toRemove.indexOf(meld.claimedTile);
        if (claimIdx >= 0) toRemove.splice(claimIdx, 1);
      }
      for (const tileId of toRemove) {
        const idx = concealed.indexOf(tileId);
        if (idx < 0) return null;
        concealed.splice(idx, 1);
      }
      melds.push({ ...meld, open: true });
      return { concealed, melds };
    }
    default:
      return null;
  }
}

function applyDiscard(view: GameState, seat: Seat, instanceId: string, melds: Meld[]): HandSnapshot | null {
  const hand = view.hands[seat];
  if (!hand.concealed.some((t) => t.instanceId === instanceId)) return null;
  const concealed = hand.concealed
    .filter((t) => t.instanceId !== instanceId)
    .map((t) => t.tileId);
  return { concealed, melds };
}

/** Score a legal action; higher is better. */
export function scoreAction(
  prompt: DecisionPrompt,
  action: LegalAction,
  weights: EvWeights,
  tracker: TileTracker,
): number {
  const view = prompt.view;
  if (!view) return 0;

  const seat = prompt.seat;
  const snap = snapshotHand(view, seat);
  const cmd = action.command;

  if (cmd.type === "hu" || cmd.type === "flower_win") return WIN_SCORE;

  if (cmd.type === "pass_claim") {
    return evalHand(view, seat, snap, weights, tracker);
  }

  if (cmd.type === "draw") {
    return evalHand(view, seat, snap, weights, tracker) + weights.draw * 0.5;
  }

  if (cmd.type === "discard") {
    const after = applyDiscard(view, seat, cmd.instanceId, snap.melds);
    if (!after) return -Infinity;
    const tile = view.hands[seat].concealed.find((t) => t.instanceId === cmd.instanceId);
    const tileId = tile?.tileId ?? "wan-1";
    return discardEv(view, seat, after, tileId, weights, tracker);
  }

  if (cmd.type === "pung" || cmd.type === "chow") {
    const after = applyClaim(snap, action);
    if (!after) return -Infinity;
    const openPenalty = weights.fan * 0.8;
    return bestPostClaimDiscardEv(view, seat, after, weights, tracker) - openPenalty;
  }

  if (cmd.type === "kong") {
    const after = applyClaim(snap, action);
    if (!after) return -Infinity;
    const openPenalty = weights.fan * 0.8;
    // Kong draws a replacement before discarding — credit the draw, then best discard.
    const withDrawBonus = bestPostClaimDiscardEv(view, seat, after, weights, tracker) + weights.draw * 0.4;
    return withDrawBonus - openPenalty;
  }

  return evalHand(view, seat, snap, weights, tracker);
}

export function pickBestAction(
  prompt: DecisionPrompt,
  weights: EvWeights,
  profileTracker?: TileTracker,
): LegalAction {
  const tracker = profileTracker ?? (prompt.view ? TileTracker.fromView(prompt.view, prompt.seat) : null);
  if (!tracker || prompt.actions.length === 0) {
    throw new Error("Cannot score without view and actions");
  }

  let best = prompt.actions[0];
  let bestScore = -Infinity;

  for (const action of prompt.actions) {
    const score = scoreAction(prompt, action, weights, tracker);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}

export interface ScoredAction {
  action: LegalAction;
  ev: number;
}

/** Score every legal action — used for softmax sampling and ML counterfactual logging. */
export function scoreAllActions(
  prompt: DecisionPrompt,
  weights: EvWeights,
  tracker?: TileTracker,
): ScoredAction[] {
  const t = tracker ?? (prompt.view ? TileTracker.fromView(prompt.view, prompt.seat) : null);
  if (!t) throw new Error("Cannot score without view");
  return prompt.actions.map((action) => ({
    action,
    ev: scoreAction(prompt, action, weights, t),
  }));
}

/** Export for tests — hand after discarding one tile by instance id. */
export function simulateDiscard(
  view: GameState,
  seat: Seat,
  instanceId: string,
  melds: Meld[],
): HandSnapshot | null {
  return applyDiscard(view, seat, instanceId, melds);
}

/** Export for tests — concealed ids after hypothetical claim. */
export function simulateClaim(snap: HandSnapshot, claim: LegalAction): HandSnapshot | null {
  return applyClaim(snap, claim);
}

export function allTileIds(snap: HandSnapshot): TileId[] {
  return [...snap.concealed, ...allMeldTiles(snap.melds)];
}
