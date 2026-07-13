import type { Phase } from "../protocol.js";

export interface TemperatureOptions {
  baseTau: number;
  wallRemaining: number;
  initialWall: number;
  phase: Phase;
}

/** Dynamic τ: higher early (explore structure), lower in claim windows (deal-in risk). */
export function computeTemperature(opts: TemperatureOptions): number {
  const wallRatio = opts.initialWall > 0 ? opts.wallRemaining / opts.initialWall : 1;
  let tau = opts.baseTau * (1 + 0.5 * wallRatio);
  if (opts.phase === "claim_window") tau = Math.min(tau, opts.baseTau * 0.65);
  return Math.max(0.05, tau);
}

/** Stable softmax sample — returns index into scores array. */
export function softmaxSample(scores: number[], tau: number, rng: () => number): number {
  if (scores.length === 0) return 0;
  if (scores.length === 1) return 0;

  const max = Math.max(...scores);
  const weights = scores.map((s) => Math.exp((s - max) / tau));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || !Number.isFinite(total)) return argmaxIndex(scores);

  let pick = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i]!;
    if (pick <= 0) return i;
  }
  return weights.length - 1;
}

export function argmaxIndex(scores: number[]): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i]! > bestScore) {
      bestScore = scores[i]!;
      best = i;
    }
  }
  return best;
}
