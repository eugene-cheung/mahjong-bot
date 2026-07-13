/** Scoring weights for the EV combination. */
export interface EvWeights {
  shanten: number;
  fan: number;
  draw: number;
  danger: number;
  /** P(tenpai) / P(improve) from tile tracker + unified shanten. */
  winRate: number;
}

export type BotProfile = "speed" | "balanced" | "aggressive" | "defensive";

export const PROFILES: Record<BotProfile, EvWeights> = {
  speed: { shanten: 12, fan: 0.4, draw: 2, danger: 0.5, winRate: 5 },
  balanced: { shanten: 10, fan: 1.2, draw: 2, danger: 1.5, winRate: 4 },
  aggressive: { shanten: 8, fan: 2.5, draw: 1.5, danger: 0.8, winRate: 3 },
  defensive: { shanten: 10, fan: 0.8, draw: 2, danger: 3.5, winRate: 4.5 },
};

export const DEFAULT_PROFILE: BotProfile = "balanced";
