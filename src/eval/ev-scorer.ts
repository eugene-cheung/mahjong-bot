import type { DecisionPrompt, GameState, LegalAction, Meld, Seat, TileId } from "../protocol.js";
import { estimateFanPotential } from "./fan-potential.js";
import { discardDanger, maxOpponentThreat } from "./opponent-threat.js";
import type { EvWeights } from "./profiles.js";
import { handShantenCounts } from "../shanten/index.js";
import { TileTracker, usefulDrawScore } from "./tile-tracker.js";
import { estimateWinRate, winRateScore } from "./win-rate.js";
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

function evalHand(
  view: GameState,
  seat: Seat,
  snap: HandSnapshot,
  weights: EvWeights,
  tracker: TileTracker,
): number {
  const handCounts = countsFromIds(snap.concealed);
  const shResult = handShantenCounts(handCounts, snap.melds.length);
  const fan = estimateFanPotential(snap.concealed, snap.melds, view.rulesetId, shResult.shape);
  const winRate = estimateWinRate(tracker, handCounts, snap.melds.length);
  const draw = usefulDrawScore(tracker, handCounts) * 0.35 + winRateScore(winRate) * 0.65;
  const threat = maxOpponentThreat(view, seat);

  return (
    -weights.shanten * shResult.shanten +
    weights.fan * fan +
    weights.draw * draw +
    weights.winRate * winRateScore(winRate) -
    weights.danger * threat * 0.15
  );
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
      let removed = 0;
      for (let i = concealed.length - 1; i >= 0 && removed < 3; i--) {
        if (concealed[i] === tileId) {
          concealed.splice(i, 1);
          removed++;
        }
      }
      if (!claim.command.concealed && removed < 3) return null;
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

  if (cmd.type === "pung" || cmd.type === "chow" || cmd.type === "kong") {
    const after = applyClaim(snap, action);
    if (!after) return -Infinity;
    const openPenalty = weights.fan * 0.8;
    return evalHand(view, seat, after, weights, tracker) - openPenalty;
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
