import type { BotStrategy, Seat } from "../protocol.js";
import { createHeuristicStrategy } from "../strategy.js";

export { createSelfPlayStrategy, createLoggingStrategy } from "./strategy.js";
export type { SelfPlayStrategyOptions } from "./strategy.js";
export {
  handEndRecord,
  matchEndRecord,
  placementFromScores,
  isDecisionRecordV2,
  isHandEndRecordV2,
  isMatchEndRecordV2,
} from "./outcomes.js";
export { joinRewards, parseSelfPlayLine, loadSelfPlayRecords, trainingRowToJson } from "./join.js";
export type { JoinRewardsResult } from "./join.js";
export { b64encode, b64decode, encodeState, relativeSeat, seatIndex } from "./encoding.js";
export { computeTemperature, softmaxSample, argmaxIndex } from "./softmax.js";
export { tuneWeightsFromLogs } from "./tune.js";
export type { TuneReport } from "./tune.js";
export { isDecisionLog, isHandOutcomeLog } from "./logger.js";
export type {
  DecisionRecordV2,
  HandEndRecordV2,
  MatchEndRecordV2,
  SelfPlayRecordV2,
  TrainingRowV2,
  SelfPlayLogEntry,
  EncodedState,
  EncodedLegalAction,
} from "./records.js";
export { SCHEMA_VERSION } from "./records.js";

/** Heuristic bot for non-logging play. */
export function createSelfPlayBot(options?: Parameters<typeof createHeuristicStrategy>[0]): BotStrategy {
  return createHeuristicStrategy(options);
}

export type SelfPlaySeat = Seat;
