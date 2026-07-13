/** Legacy v1 log helpers — superseded by v2 records in strategy.ts / outcomes.ts. */

export type {
  DecisionLogEntryV1 as DecisionLogEntry,
  HandOutcomeLogEntryV1 as HandOutcomeLogEntry,
  SelfPlayLogEntry,
  DecisionRecordV2,
  HandEndRecordV2,
  MatchEndRecordV2,
  SelfPlayRecordV2,
  TrainingRowV2,
} from "./records.js";

export { createSelfPlayStrategy, createLoggingStrategy } from "./strategy.js";
export type { SelfPlayStrategyOptions } from "./strategy.js";
export { handEndRecord, matchEndRecord } from "./outcomes.js";
export { joinRewards, parseSelfPlayLine, loadSelfPlayRecords } from "./join.js";
export type { JoinRewardsResult } from "./join.js";

import type { SelfPlayLogEntry } from "./records.js";

export function isDecisionLog(entry: SelfPlayLogEntry): boolean {
  if ("kind" in entry && entry.kind === "decision") return true;
  return "actionType" in entry;
}

export function isHandOutcomeLog(entry: SelfPlayLogEntry): boolean {
  if ("kind" in entry && entry.kind === "hand_end") return true;
  if ("kind" in entry && entry.kind === "match_end") return false;
  return "winner" in entry && !("actionType" in entry);
}
