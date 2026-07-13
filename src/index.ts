export {
  heuristicStrategy,
  createHeuristicStrategy,
  standardShanten,
  handShanten,
} from "./strategy.js";
export type { HeuristicOptions, HandShape, ShantenResult } from "./strategy.js";
export type { BotProfile, EvWeights } from "./eval/profiles.js";
export { PROFILES, DEFAULT_PROFILE } from "./eval/profiles.js";
export { TileTracker, usefulDrawScore } from "./eval/tile-tracker.js";
export { estimateFanPotential } from "./eval/fan-potential.js";
export { resolveWeights } from "./eval/match-context.js";
export { scoreAction, scoreAllActions, pickBestAction } from "./eval/ev-scorer.js";
export { estimateWinRate, winRateScore } from "./eval/win-rate.js";
export { pickBestActionMonteCarlo } from "./eval/monte-carlo.js";
export { HandCounts, ORPHAN_INDICES, NUM_TILE_TYPES } from "./bitboard.js";
export {
  createSelfPlayStrategy,
  createLoggingStrategy,
  handEndRecord,
  matchEndRecord,
  joinRewards,
  loadSelfPlayRecords,
  parseSelfPlayLine,
  trainingRowToJson,
  tuneWeightsFromLogs,
  createSelfPlayBot,
  b64encode,
  b64decode,
  encodeState,
  computeTemperature,
  softmaxSample,
  SCHEMA_VERSION,
} from "./self-play/index.js";
export type {
  SelfPlayStrategyOptions,
  DecisionRecordV2,
  HandEndRecordV2,
  MatchEndRecordV2,
  SelfPlayRecordV2,
  TrainingRowV2,
  SelfPlayLogEntry,
  EncodedState,
  EncodedLegalAction,
  JoinRewardsResult,
  TuneReport,
} from "./self-play/index.js";
