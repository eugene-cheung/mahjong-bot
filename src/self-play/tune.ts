import type { EvWeights } from "../eval/profiles.js";
import { PROFILES } from "../eval/profiles.js";
import type { BotProfile } from "../eval/profiles.js";
import type { SelfPlayLogEntry } from "./records.js";
import { isDecisionLog, isHandOutcomeLog } from "./logger.js";

export interface TuneReport {
  profile: BotProfile;
  samples: number;
  wins: number;
  avgFanOnWin: number;
  avgShantenOnDecision: number;
  suggested: EvWeights;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function shantenFromEntry(entry: SelfPlayLogEntry): number | null {
  if ("state" in entry && entry.state?.scalars) return entry.state.scalars[1] ?? null;
  if ("shanten" in entry) return entry.shanten;
  return null;
}

function unitsFromOutcome(entry: SelfPlayLogEntry): number | null {
  if ("units" in entry) return entry.units;
  if ("fan" in entry) return entry.fan;
  return null;
}

/** Derive weight tweaks from self-play JSONL logs (heuristic bandit step). */
export function tuneWeightsFromLogs(
  entries: SelfPlayLogEntry[],
  profile: BotProfile = "balanced",
): TuneReport {
  const base = { ...PROFILES[profile] };
  const decisions = entries.filter(isDecisionLog);
  const outcomes = entries.filter(isHandOutcomeLog);

  const wins = outcomes.filter((o) => {
    if ("winner" in o && o.winner !== null) return true;
    return false;
  });
  const avgFanOnWin = avg(
    wins.map((w) => unitsFromOutcome(w)).filter((u): u is number => u !== null),
  );
  const shantenValues = decisions.map(shantenFromEntry).filter((s): s is number => s !== null);
  const avgShanten = avg(shantenValues);

  const suggested = { ...base };

  if (avgShanten <= 1.2) {
    suggested.fan *= 1.08;
    suggested.winRate *= 0.95;
  } else if (avgShanten >= 2.5) {
    suggested.shanten *= 1.05;
    suggested.winRate *= 1.1;
  }

  if (avgFanOnWin >= 4) {
    suggested.fan *= 1.05;
  } else if (avgFanOnWin > 0 && avgFanOnWin < 2) {
    suggested.fan *= 1.12;
    suggested.shanten *= 0.97;
  }

  const winRate = outcomes.length > 0 ? wins.length / outcomes.length : 0;
  if (winRate < 0.2) {
    suggested.danger *= 1.08;
  }

  return {
    profile,
    samples: decisions.length,
    wins: wins.length,
    avgFanOnWin,
    avgShantenOnDecision: avgShanten,
    suggested,
  };
}
