/** Self-play JSONL schema v2. */

export const SCHEMA_VERSION = 2 as const;

export interface EncodedState {
  /** base64 Uint8Array(34) — concealed hand counts (relative to acting seat). */
  hand: string;
  /** Per relative seat 0=self..3=left — base64 discard counts. */
  discards: [string, string, string, string];
  /** [relativeSeat, kindCode, tileIndex, openFlag] — kind: 0=chow, 1=pung, 2=kong. */
  melds: [number, number, number, number][];
  /** base64 — copies remaining in wall per tile type. */
  remaining: string;
  /** base64 — 1 if tile type exhausted (kabe), else 0. */
  exhausted: string;
  /** [wall, shanten, selfScore, rScore, acrossScore, lScore, dealerRel, phaseCode, openSelf, openMaxOpp]. */
  scalars: number[];
}

export interface EncodedLegalAction {
  id: number;
  type: string;
  ev: number;
  tile?: number;
  inst?: string;
}

export interface ClaimContext {
  from: number;
  tile: number;
}

export interface DecisionRecordV2 {
  v: typeof SCHEMA_VERSION;
  kind: "decision";
  ts: string;
  matchId: string;
  handIndex: number;
  decisionIndex: number;
  /** Absolute seat index: 0=east, 1=south, 2=west, 3=north. State encoded relative to this seat. */
  seat: number;
  phase: string;
  rulesetId: string;
  state: EncodedState;
  claim?: ClaimContext;
  legal: EncodedLegalAction[];
  chosen: number;
  tau: number;
  sampled: boolean;
}

export interface HandEndRecordV2 {
  v: typeof SCHEMA_VERSION;
  kind: "hand_end";
  ts: string;
  matchId: string;
  handIndex: number;
  winner: number | null;
  units: number;
  scores: number[];
  scoreDelta: number[];
}

export interface MatchEndRecordV2 {
  v: typeof SCHEMA_VERSION;
  kind: "match_end";
  ts: string;
  matchId: string;
  placement: number[];
  finalScores: number[];
  handsPlayed: number;
  startScores: number[];
}

export type SelfPlayRecordV2 = DecisionRecordV2 | HandEndRecordV2 | MatchEndRecordV2;

/** @deprecated v1 decision row — kept for tune script compatibility. */
export interface DecisionLogEntryV1 {
  ts: string;
  matchId: string;
  handIndex: number;
  seat: string;
  phase: string;
  rulesetId: string;
  shanten: number;
  shape: string;
  fanPotential: number;
  wallRemaining: number;
  actionType: string;
  actionLabel: string;
}

export interface HandOutcomeLogEntryV1 {
  ts: string;
  matchId: string;
  handIndex: number;
  winner: string | null;
  fan: number;
  scores: Record<string, number>;
}

export type SelfPlayLogEntry = SelfPlayRecordV2 | DecisionLogEntryV1 | HandOutcomeLogEntryV1;

export interface TrainingRowV2 {
  v: typeof SCHEMA_VERSION;
  kind: "training";
  matchId: string;
  handIndex: number;
  decisionIndex: number;
  seat: number;
  state: EncodedState;
  claim?: ClaimContext;
  legal: EncodedLegalAction[];
  chosen: number;
  tau: number;
  handReward: number;
  matchReward: number;
  placement: number;
}
