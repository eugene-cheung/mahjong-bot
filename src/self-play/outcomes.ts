import type {
  DecisionRecordV2,
  HandEndRecordV2,
  MatchEndRecordV2,
  SelfPlayRecordV2,
} from "./records.js";
import { SCHEMA_VERSION } from "./records.js";
import { seatIndex, indexToSeat } from "./encoding.js";
import type { Seat } from "../protocol.js";
import { SEATS } from "../protocol.js";

export function handEndRecord(
  matchId: string,
  handIndex: number,
  winner: Seat | null,
  units: number,
  scoresAfter: Record<Seat, number>,
  scoresBefore: Record<Seat, number>,
): HandEndRecordV2 {
  const scores = SEATS.map((s) => scoresAfter[s]);
  const scoreDelta = SEATS.map((s) => scoresAfter[s] - scoresBefore[s]);
  return {
    v: SCHEMA_VERSION,
    kind: "hand_end",
    ts: new Date().toISOString(),
    matchId,
    handIndex,
    winner: winner ? seatIndex(winner) : null,
    units,
    scores,
    scoreDelta,
  };
}

export function matchEndRecord(
  matchId: string,
  finalScores: Record<Seat, number>,
  startScores: Record<Seat, number>,
  handsPlayed: number,
): MatchEndRecordV2 {
  const final = SEATS.map((s) => finalScores[s]);
  const start = SEATS.map((s) => startScores[s]);
  const placement = placementFromScores(finalScores);
  return {
    v: SCHEMA_VERSION,
    kind: "match_end",
    ts: new Date().toISOString(),
    matchId,
    placement,
    finalScores: final,
    handsPlayed,
    startScores: start,
  };
}

/** 0=1st place seat index, etc. */
export function placementFromScores(scores: Record<Seat, number>): number[] {
  return [...SEATS]
    .sort((a, b) => scores[b] - scores[a])
    .map((s) => seatIndex(s));
}

export function placementRank(placement: number[], seat: number): number {
  return placement.indexOf(seat);
}

export function isDecisionRecordV2(entry: SelfPlayRecordV2): entry is DecisionRecordV2 {
  return entry.kind === "decision";
}

export function isHandEndRecordV2(entry: SelfPlayRecordV2): entry is HandEndRecordV2 {
  return entry.kind === "hand_end";
}

export function isMatchEndRecordV2(entry: SelfPlayRecordV2): entry is MatchEndRecordV2 {
  return entry.kind === "match_end";
}

export { indexToSeat };
