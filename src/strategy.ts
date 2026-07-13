import type { BotStrategy, DecisionPrompt, LegalAction } from "./protocol.js";
import { pickBestAction } from "./eval/ev-scorer.js";
import { pickBestActionMonteCarlo } from "./eval/monte-carlo.js";
import { resolveWeights } from "./eval/match-context.js";
import { TileTracker } from "./eval/tile-tracker.js";
import { DEFAULT_PROFILE } from "./eval/profiles.js";
import type { BotProfile } from "./eval/profiles.js";

function pickInstantWin(actions: LegalAction[]): LegalAction | undefined {
  return (
    actions.find((a) => a.command.type === "flower_win" && a.label.includes("Eight")) ??
    actions.find((a) => a.command.type === "flower_win") ??
    actions.find((a) => a.command.type === "hu")
  );
}

export interface HeuristicOptions {
  profile?: BotProfile;
  maxHands?: number;
  /** `ev` = fast heuristic scoring; `mc` = blended Monte Carlo rollouts. */
  search?: "ev" | "mc";
  mcRollouts?: number;
  mcMaxDraws?: number;
}

export function createHeuristicStrategy(options: HeuristicOptions = {}): BotStrategy {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const maxHands = options.maxHands;
  const search = options.search ?? "ev";
  const mcRollouts = options.mcRollouts ?? 24;
  const mcMaxDraws = options.mcMaxDraws ?? 8;

  return {
    choose(prompt, rng) {
      if (prompt.actions.length === 0) {
        throw new Error(`No legal actions for ${prompt.seat}`);
      }

      const instant = pickInstantWin(prompt.actions);
      if (instant) return instant;

      if (!prompt.view) {
        throw new Error(`Heuristic bot requires view for ${prompt.phase} (${prompt.seat})`);
      }

      const weights = resolveWeights(profile, prompt.view, prompt.seat, maxHands);
      const tracker = TileTracker.fromView(prompt.view, prompt.seat);

      if (search === "mc") {
        return pickBestActionMonteCarlo(prompt, weights, tracker, {
          rollouts: mcRollouts,
          maxDraws: mcMaxDraws,
          rng,
        });
      }

      return pickBestAction(prompt, weights, tracker);
    },
  };
}

/** Default balanced heuristic used by mahjong-table. */
export const heuristicStrategy: BotStrategy = createHeuristicStrategy();

export { handShanten, standardShanten } from "./shanten.js";
export type { HandShape, ShantenResult } from "./shanten/index.js";
