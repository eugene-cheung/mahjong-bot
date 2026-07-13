import type { GameState, Seat } from "../protocol.js";
import { SEATS } from "../protocol.js";
import type { BotProfile, EvWeights } from "./profiles.js";
import { PROFILES } from "./profiles.js";

const DEFAULT_MAX_HANDS = 8;

/** Adjust profile weights for match placement and late-game survival. */
export function resolveWeights(
  profile: BotProfile,
  view: GameState,
  seat: Seat,
  maxHands = DEFAULT_MAX_HANDS,
): EvWeights {
  const base = { ...PROFILES[profile] };
  const scores = view.scores;
  if (!scores) return base;

  const myScore = scores[seat];
  const ordered = SEATS.map((s) => scores[s]).sort((a, b) => b - a);
  const leaderScore = ordered[0];
  const trailing = leaderScore - myScore;
  const leading = myScore - Math.min(...SEATS.map((s) => scores[s]));
  const handIndex = view.handIndex ?? 1;
  const handsLeft = Math.max(1, maxHands - handIndex + 1);
  const lateMatch = handsLeft <= 2 || handIndex >= maxHands - 1;

  if (lateMatch && leading >= 15) {
    base.shanten *= 1.15;
    base.fan *= 0.55;
    base.danger *= 1.6;
  }

  if (lateMatch && trailing >= 20) {
    base.fan *= 1.45;
    base.shanten *= 0.92;
    base.danger *= 0.75;
  }

  if (view.dealer?.dealer === seat && trailing > 10) {
    base.fan *= 1.1;
  }

  return base;
}
