import type {
  DecisionRecordV2,
  HandEndRecordV2,
  MatchEndRecordV2,
  SelfPlayRecordV2,
  TrainingRowV2,
} from "./records.js";
import { SCHEMA_VERSION } from "./records.js";
import { placementRank } from "./outcomes.js";

const PLACEMENT_REWARD = [3, 1, -1, -3];

function isV2Record(line: unknown): line is SelfPlayRecordV2 {
  return (
    typeof line === "object" &&
    line !== null &&
    "v" in line &&
    (line as { v: number }).v === SCHEMA_VERSION &&
    "kind" in line
  );
}

export function parseSelfPlayLine(line: string): SelfPlayRecordV2 | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return isV2Record(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadSelfPlayRecords(lines: string[]): SelfPlayRecordV2[] {
  return lines.map((l) => parseSelfPlayLine(l.trim())).filter((r): r is SelfPlayRecordV2 => r !== null);
}

export interface JoinRewardsResult {
  trainingRows: TrainingRowV2[];
  decisions: number;
  hands: number;
  matches: number;
}

/** Attach hand-level and match-level rewards to v2 decision rows. */
export function joinRewards(records: SelfPlayRecordV2[]): JoinRewardsResult {
  const decisions: DecisionRecordV2[] = [];
  const handEnds = new Map<string, HandEndRecordV2>();
  const matchEnds = new Map<string, MatchEndRecordV2>();

  for (const record of records) {
    if (record.kind === "decision") decisions.push(record);
    else if (record.kind === "hand_end") handEnds.set(`${record.matchId}:${record.handIndex}`, record);
    else if (record.kind === "match_end") matchEnds.set(record.matchId, record);
  }

  const trainingRows: TrainingRowV2[] = [];

  for (const d of decisions) {
    const handKey = `${d.matchId}:${d.handIndex}`;
    const hand = handEnds.get(handKey);
    const match = matchEnds.get(d.matchId);

    const handReward = hand?.scoreDelta[d.seat] ?? 0;
    const placement = match ? placementRank(match.placement, d.seat) : 2;
    const matchReward = match ? PLACEMENT_REWARD[placement] ?? 0 : 0;

    trainingRows.push({
      v: SCHEMA_VERSION,
      kind: "training",
      matchId: d.matchId,
      handIndex: d.handIndex,
      decisionIndex: d.decisionIndex,
      seat: d.seat,
      state: d.state,
      claim: d.claim,
      legal: d.legal,
      chosen: d.chosen,
      tau: d.tau,
      handReward,
      matchReward,
      placement,
    });
  }

  const matchIds = new Set(decisions.map((d) => d.matchId));
  return {
    trainingRows,
    decisions: decisions.length,
    hands: handEnds.size,
    matches: matchIds.size,
  };
}

export function trainingRowToJson(row: TrainingRowV2): string {
  return JSON.stringify(row);
}
