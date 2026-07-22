import type { DecisionPrompt, LegalAction, TileId } from "../protocol.js";
import { HandCounts, NUM_TILE_TYPES } from "../bitboard.js";
import { handShantenCounts } from "../shanten/index.js";
import { indexToTile } from "../tiles.js";
import { estimateFanPotential } from "./fan-potential.js";
import type { EvWeights } from "./profiles.js";
import type { TileTracker } from "./tile-tracker.js";
import {
  scoreAction,
  simulateClaim,
  simulateDiscard,
  snapshotHand,
  type HandSnapshot,
} from "./ev-scorer.js";
import type { GameState, Seat } from "../protocol.js";

export interface MonteCarloOptions {
  rollouts: number;
  maxDraws: number;
  rng: () => number;
}

const DEFAULT_MC: Omit<MonteCarloOptions, "rng"> = { rollouts: 24, maxDraws: 8 };

function applyActionToCounts(
  view: GameState,
  seat: Seat,
  snap: HandSnapshot,
  action: LegalAction,
  weights: EvWeights,
): { counts: HandCounts; melds: HandSnapshot["melds"]; evBias: number } | null {
  if (action.command.type === "discard") {
    const after = simulateDiscard(view, seat, action.command.instanceId, snap.melds);
    if (!after) return null;
    return { counts: HandCounts.fromIds(after.concealed), melds: after.melds, evBias: 0 };
  }
  if (action.command.type === "pass_claim" || action.command.type === "draw") {
    return { counts: HandCounts.fromIds(snap.concealed), melds: snap.melds, evBias: 0 };
  }
  if (action.command.type === "hu" || action.command.type === "flower_win") {
    return { counts: HandCounts.fromIds(snap.concealed), melds: snap.melds, evBias: 0 };
  }
  const after = simulateClaim(snap, action);
  if (!after) return null;

  // Align MC start state with EV: pung/chow must discard; kong gets a small draw bias.
  if (action.command.type === "pung" || action.command.type === "chow") {
    const best = bestForcedDiscardCounts(after);
    if (!best) return null;
    return { counts: best.counts, melds: after.melds, evBias: 0 };
  }
  if (action.command.type === "kong") {
    return {
      counts: HandCounts.fromIds(after.concealed),
      melds: after.melds,
      evBias: weights.draw * 0.4,
    };
  }
  return { counts: HandCounts.fromIds(after.concealed), melds: after.melds, evBias: 0 };
}

/** Greedy lowest-shanten discard after a claim (matches EV post-claim policy). */
function bestForcedDiscardCounts(
  after: HandSnapshot,
): { counts: HandCounts; discarded: TileId } | null {
  if (after.concealed.length === 0) return null;
  let bestIdx = -1;
  let bestSh = Infinity;
  let bestTile: TileId | null = null;
  const seen = new Set<TileId>();
  for (let i = 0; i < after.concealed.length; i++) {
    const tileId = after.concealed[i]!;
    if (seen.has(tileId)) continue;
    seen.add(tileId);
    const concealed = after.concealed.slice(0, i).concat(after.concealed.slice(i + 1));
    const counts = HandCounts.fromIds(concealed);
    const sh = handShantenCounts(counts.counts, after.melds.length).shanten;
    if (sh < bestSh) {
      bestSh = sh;
      bestIdx = i;
      bestTile = tileId;
    }
  }
  if (bestIdx < 0 || !bestTile) return null;
  const concealed = after.concealed.slice(0, bestIdx).concat(after.concealed.slice(bestIdx + 1));
  return { counts: HandCounts.fromIds(concealed), discarded: bestTile };
}

function cloneRemaining(tracker: TileTracker): Uint8Array {
  const rem = new Uint8Array(NUM_TILE_TYPES);
  for (let i = 0; i < NUM_TILE_TYPES; i++) rem[i] = tracker.remainingAt(i);
  return rem;
}

function drawFromRemaining(remaining: Uint8Array, rng: () => number): number | null {
  let total = 0;
  for (let i = 0; i < NUM_TILE_TYPES; i++) total += remaining[i];
  if (total <= 0) return null;
  let pick = Math.floor(rng() * total);
  for (let i = 0; i < NUM_TILE_TYPES; i++) {
    pick -= remaining[i];
    if (pick < 0) {
      remaining[i]--;
      return i;
    }
  }
  return null;
}

/** Discard the tile that leaves the lowest shanten (greedy rollout policy). */
function rolloutDiscard(counts: HandCounts, openMelds: number): void {
  let bestIdx = -1;
  let bestSh = Infinity;
  for (let idx = 0; idx < NUM_TILE_TYPES; idx++) {
    if (counts.counts[idx] === 0) continue;
    counts.removeIndex(idx);
    const sh = handShantenCounts(counts.counts, openMelds).shanten;
    counts.addIndex(idx);
    if (sh < bestSh) {
      bestSh = sh;
      bestIdx = idx;
    }
  }
  if (bestIdx >= 0) counts.removeIndex(bestIdx);
}

function simulateRollout(
  view: GameState,
  seat: Seat,
  startCounts: HandCounts,
  melds: HandSnapshot["melds"],
  remaining: Uint8Array,
  options: MonteCarloOptions,
): number {
  const openMelds = melds.length;
  const counts = startCounts.clone();

  if (handShantenCounts(counts.counts, openMelds).shanten <= -1) {
    const shape = handShantenCounts(counts.counts, openMelds).shape;
    return 100 + estimateFanPotential(
      countsToIds(counts),
      melds,
      view.rulesetId,
      shape,
      { seat, dealer: view.dealer?.dealer, roundWind: view.dealer?.roundWind },
    );
  }

  for (let turn = 0; turn < options.maxDraws; turn++) {
    const drawn = drawFromRemaining(remaining, options.rng);
    if (drawn === null) break;
    counts.addIndex(drawn);
    const sh = handShantenCounts(counts.counts, openMelds);
    if (sh.shanten <= -1) {
      return 80 + estimateFanPotential(countsToIds(counts), melds, view.rulesetId, sh.shape, {
        seat,
        dealer: view.dealer?.dealer,
        roundWind: view.dealer?.roundWind,
      });
    }
    if (sh.shanten === 0) {
      // Stay in tenpai and keep trying to win rather than stopping early.
      rolloutDiscard(counts, openMelds);
      continue;
    }
    rolloutDiscard(counts, openMelds);
  }

  const final = handShantenCounts(counts.counts, openMelds);
  return (
    -final.shanten * 5 +
    estimateFanPotential(countsToIds(counts), melds, view.rulesetId, final.shape, {
      seat,
      dealer: view.dealer?.dealer,
      roundWind: view.dealer?.roundWind,
    }) * 0.5
  );
}

function countsToIds(hand: HandCounts): TileId[] {
  const ids: TileId[] = [];
  for (let i = 0; i < NUM_TILE_TYPES; i++) {
    const id = indexToTile(i);
    if (!id) continue;
    for (let n = 0; n < hand.counts[i]; n++) ids.push(id);
  }
  return ids;
}

export function scoreActionMonteCarlo(
  prompt: DecisionPrompt,
  action: LegalAction,
  weights: EvWeights,
  tracker: TileTracker,
  options: MonteCarloOptions,
): number {
  const view = prompt.view;
  if (!view) return -Infinity;

  if (action.command.type === "hu" || action.command.type === "flower_win") {
    return 1_000_000;
  }

  const evScore = scoreAction(prompt, action, weights, tracker);
  const snap = snapshotHand(view, prompt.seat);
  const applied = applyActionToCounts(view, prompt.seat, snap, action, weights);
  if (!applied) return -Infinity;

  const remaining = cloneRemaining(tracker);
  let sum = 0;
  for (let i = 0; i < options.rollouts; i++) {
    sum += simulateRollout(
      view,
      prompt.seat,
      applied.counts,
      applied.melds,
      new Uint8Array(remaining),
      options,
    );
  }
  const mcMean = sum / options.rollouts + applied.evBias;
  return evScore * 0.35 + mcMean * 0.65;
}

export function pickBestActionMonteCarlo(
  prompt: DecisionPrompt,
  weights: EvWeights,
  tracker: TileTracker,
  options: Partial<MonteCarloOptions> & { rng: () => number },
): LegalAction {
  const mc: MonteCarloOptions = {
    rollouts: options.rollouts ?? DEFAULT_MC.rollouts,
    maxDraws: options.maxDraws ?? DEFAULT_MC.maxDraws,
    rng: options.rng,
  };

  let best = prompt.actions[0];
  let bestScore = -Infinity;
  for (const action of prompt.actions) {
    const score = scoreActionMonteCarlo(prompt, action, weights, tracker, mc);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

/** Test helper — expose greedy discard policy. */
export function testRolloutDiscard(counts: HandCounts, openMelds: number): void {
  rolloutDiscard(counts, openMelds);
}
