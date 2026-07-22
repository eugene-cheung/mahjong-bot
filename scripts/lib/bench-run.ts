/**
 * Shared benchmark runner — heuristic vs random or heuristic vs heuristic.
 */

import { Table } from "mahjong-table/match/table";
import { createDefaultMatchConfig } from "mahjong-table/match/config";
import { BotPlayer, randomBotStrategy, type BotStrategy } from "mahjong-table/seats/bot";
import { createHeuristicStrategy, heuristicStrategy, placementFromScores } from "../../dist/index.js";
import type { Seat } from "mahjong-table/bot-sdk";

const SEATS: Seat[] = ["east", "south", "west", "north"];

export type BenchMode = "vs-random" | "vs-heuristic";

export interface BenchmarkConfig {
  matches: number;
  maxActions: number;
  seedBase?: number;
  ruleset?: "hong-kong" | "taiwanese";
  maxHands?: number;
  mode?: BenchMode;
}

export interface SeatMetrics {
  wins: number;
  dealIns: number;
  selfDraws: number;
  unitsSum: number;
  scoreSum: number;
  placementSum: number;
  /** Times this seat finished 1st. */
  firstPlaces: number;
}

export interface BenchmarkResult {
  label?: string;
  recordedAt: string;
  elapsedMs: number;
  config: BenchmarkConfig;
  /** Primary seat (rotating) aggregate — kept for baseline compatibility. */
  heuristicWins: number;
  randomWins: number;
  heuristicScoreSum: number;
  randomScoreSum: number;
  /** Richer metrics for the primary (focal) seat. */
  focal: SeatMetrics;
  /** Opponents aggregated (3 seats in vs-random; 3 heuristic seats in vs-heuristic). */
  opponents: SeatMetrics;
}

function emptyMetrics(): SeatMetrics {
  return {
    wins: 0,
    dealIns: 0,
    selfDraws: 0,
    unitsSum: 0,
    scoreSum: 0,
    placementSum: 0,
    firstPlaces: 0,
  };
}

function addMetrics(target: SeatMetrics, add: SeatMetrics): void {
  target.wins += add.wins;
  target.dealIns += add.dealIns;
  target.selfDraws += add.selfDraws;
  target.unitsSum += add.unitsSum;
  target.scoreSum += add.scoreSum;
  target.placementSum += add.placementSum;
  target.firstPlaces += add.firstPlaces;
}

async function runMatch(
  seed: number,
  focalSeat: Seat,
  maxActions: number,
  ruleset: "hong-kong" | "taiwanese",
  maxHands: number,
  mode: BenchMode,
): Promise<{ focal: SeatMetrics; opponents: SeatMetrics }> {
  const config = createDefaultMatchConfig(ruleset, "east", { maxHands });
  config.seed = seed;
  config.matchId = `bench-${seed}`;
  config.seats = SEATS.map((seat) => ({
    seat,
    kind: "bot" as const,
    displayName:
      mode === "vs-heuristic"
        ? seat === focalSeat
          ? "Focal"
          : "Heuristic"
        : seat === focalSeat
          ? "Heuristic"
          : "Random",
  })) as typeof config.seats;

  const opponentStrategy: BotStrategy =
    mode === "vs-heuristic" ? createHeuristicStrategy({ profile: "balanced" }) : randomBotStrategy;

  const table = new Table(config, (seat, _kind, displayName) => {
    if (seat === focalSeat) {
      return new BotPlayer(seat, displayName, heuristicStrategy);
    }
    return new BotPlayer(seat, displayName, opponentStrategy);
  });

  const perSeat = Object.fromEntries(SEATS.map((s) => [s, emptyMetrics()])) as Record<Seat, SeatMetrics>;

  table.bus.subscribe((event) => {
    if (event.type === "hand_scored" && event.result.winner) {
      const winner = event.result.winner;
      perSeat[winner].wins++;
      perSeat[winner].unitsSum += event.result.units;
      if (event.result.selfDraw) perSeat[winner].selfDraws++;
      if (!event.result.selfDraw && event.result.discarder) {
        perSeat[event.result.discarder].dealIns++;
      }
    }
    if (event.type === "hand_scored" || event.type === "hand_complete") {
      table.ackHandResult();
    }
  });

  await table.start({ maxActions });

  const scores = table.engine.getState().scores;
  const placement = placementFromScores(scores);
  for (const seat of SEATS) {
    perSeat[seat].scoreSum = scores[seat];
    const seatIdx = SEATS.indexOf(seat);
    const place = placement.indexOf(seatIdx);
    perSeat[seat].placementSum = place;
    if (place === 0) perSeat[seat].firstPlaces = 1;
  }

  const focal = { ...perSeat[focalSeat] };
  const opponents = emptyMetrics();
  for (const seat of SEATS) {
    if (seat === focalSeat) continue;
    addMetrics(opponents, perSeat[seat]);
  }
  return { focal, opponents };
}

export async function runBenchmark(
  config: BenchmarkConfig,
  onProgress?: (match: number, total: number) => void,
): Promise<BenchmarkResult> {
  const seedBase = config.seedBase ?? 10_000;
  const ruleset = config.ruleset ?? "hong-kong";
  const maxHands = config.maxHands ?? 2;
  const mode = config.mode ?? "vs-random";
  const started = Date.now();

  const focal = emptyMetrics();
  const opponents = emptyMetrics();

  for (let i = 0; i < config.matches; i++) {
    onProgress?.(i + 1, config.matches);
    const seat = SEATS[i % SEATS.length]!;
    const result = await runMatch(seedBase + i, seat, config.maxActions, ruleset, maxHands, mode);
    addMetrics(focal, result.focal);
    addMetrics(opponents, result.opponents);
  }

  return {
    recordedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    config: { ...config, mode },
    heuristicWins: focal.wins,
    randomWins: opponents.wins,
    heuristicScoreSum: focal.scoreSum,
    randomScoreSum: opponents.scoreSum,
    focal,
    opponents,
  };
}

export function formatBenchmarkSummary(result: BenchmarkResult): string {
  const { config: c, focal, opponents } = result;
  const mode = c.mode ?? "vs-random";
  const matches = c.matches;
  const lines = [
    `Benchmark (${matches} matches, mode=${mode}, focal seat rotates):`,
    `  Focal wins: ${focal.wins}  |  Opponent wins: ${opponents.wins}`,
    `  Focal score sum: ${focal.scoreSum}  |  Opponent score sum: ${opponents.scoreSum}`,
    `  Focal deal-ins: ${focal.dealIns}  |  Opponent deal-ins: ${opponents.dealIns}`,
    `  Focal self-draws: ${focal.selfDraws}  |  Avg fan when won: ${focal.wins ? (focal.unitsSum / focal.wins).toFixed(2) : "n/a"}`,
    `  Focal 1st-place finishes: ${focal.firstPlaces}/${matches}  |  Avg place: ${(focal.placementSum / matches).toFixed(2)}`,
    `  Elapsed: ${(result.elapsedMs / 1000).toFixed(1)}s`,
  ];
  return lines.join("\n");
}

export interface BenchmarkDelta {
  heuristicWins: number;
  randomWins: number;
  heuristicScoreSum: number;
  randomScoreSum: number;
}

export function compareToBaseline(current: BenchmarkResult, baseline: BenchmarkResult): BenchmarkDelta {
  return {
    heuristicWins: current.heuristicWins - baseline.heuristicWins,
    randomWins: current.randomWins - baseline.randomWins,
    heuristicScoreSum: current.heuristicScoreSum - baseline.heuristicScoreSum,
    randomScoreSum: current.randomScoreSum - baseline.randomScoreSum,
  };
}

export function formatDelta(delta: BenchmarkDelta, baselineLabel: string): string {
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return [
    `Delta vs ${baselineLabel}:`,
    `  Heuristic wins: ${sign(delta.heuristicWins)}`,
    `  Random wins:    ${sign(delta.randomWins)}`,
    `  Heuristic score: ${sign(delta.heuristicScoreSum)}`,
    `  Random score:    ${sign(delta.randomScoreSum)}`,
  ].join("\n");
}
