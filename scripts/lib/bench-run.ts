/**
 * Shared heuristic vs random benchmark runner.
 */

import { Table } from "mahjong-table/match/table";
import { createDefaultMatchConfig } from "mahjong-table/match/config";
import { BotPlayer, randomBotStrategy } from "mahjong-table/seats/bot";
import { heuristicStrategy } from "../../dist/index.js";
import type { Seat } from "mahjong-table/bot-sdk";

const SEATS: Seat[] = ["east", "south", "west", "north"];

export interface BenchmarkConfig {
  matches: number;
  maxActions: number;
  seedBase?: number;
  ruleset?: "hong-kong" | "taiwanese";
  maxHands?: number;
}

export interface BenchmarkResult {
  label?: string;
  recordedAt: string;
  elapsedMs: number;
  config: BenchmarkConfig;
  heuristicWins: number;
  randomWins: number;
  heuristicScoreSum: number;
  randomScoreSum: number;
}

interface Stats {
  wins: number;
  totalScore: number;
}

async function runMatch(
  seed: number,
  heuristicSeat: Seat,
  maxActions: number,
  ruleset: "hong-kong" | "taiwanese",
  maxHands: number,
): Promise<{ heuristic: Stats; random: Stats }> {
  const config = createDefaultMatchConfig(ruleset, "east", { maxHands });
  config.seed = seed;
  config.matchId = `bench-${seed}`;
  config.seats = SEATS.map((seat) => ({
    seat,
    kind: "bot" as const,
    displayName: seat === heuristicSeat ? "Heuristic" : "Random",
  })) as typeof config.seats;

  const table = new Table(config, (seat, _kind, displayName) => {
    if (seat === heuristicSeat) {
      return new BotPlayer(seat, displayName, heuristicStrategy);
    }
    return new BotPlayer(seat, displayName, randomBotStrategy);
  });

  let heuristicWins = 0;
  let randomWins = 0;
  table.bus.subscribe((event) => {
    if (event.type === "hand_scored" && event.result.winner) {
      if (event.result.winner === heuristicSeat) heuristicWins++;
      else randomWins++;
    }
    if (event.type === "hand_scored" || event.type === "hand_complete") {
      table.ackHandResult();
    }
  });

  await table.start({ maxActions });

  const scores = table.engine.getState().scores;
  return {
    heuristic: { wins: heuristicWins, totalScore: scores[heuristicSeat] },
    random: {
      wins: randomWins,
      totalScore: SEATS.filter((s) => s !== heuristicSeat).reduce((sum, s) => sum + scores[s], 0),
    },
  };
}

export async function runBenchmark(
  config: BenchmarkConfig,
  onProgress?: (match: number, total: number) => void,
): Promise<BenchmarkResult> {
  const seedBase = config.seedBase ?? 10_000;
  const ruleset = config.ruleset ?? "hong-kong";
  const maxHands = config.maxHands ?? 2;
  const started = Date.now();

  let hWins = 0;
  let rWins = 0;
  let hScore = 0;
  let rScore = 0;

  for (let i = 0; i < config.matches; i++) {
    onProgress?.(i + 1, config.matches);
    const seat = SEATS[i % SEATS.length]!;
    const { heuristic, random } = await runMatch(seedBase + i, seat, config.maxActions, ruleset, maxHands);
    hWins += heuristic.wins;
    rWins += random.wins;
    hScore += heuristic.totalScore;
    rScore += random.totalScore;
  }

  return {
    recordedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    config,
    heuristicWins: hWins,
    randomWins: rWins,
    heuristicScoreSum: hScore,
    randomScoreSum: rScore,
  };
}

export function formatBenchmarkSummary(result: BenchmarkResult): string {
  const { config: c } = result;
  return [
    `Benchmark (${c.matches} matches, heuristic seat rotates):`,
    `  Heuristic wins: ${result.heuristicWins}`,
    `  Random wins:    ${result.randomWins}`,
    `  Heuristic score sum: ${result.heuristicScoreSum}`,
    `  Random score sum:    ${result.randomScoreSum}`,
    `  Elapsed: ${(result.elapsedMs / 1000).toFixed(1)}s`,
  ].join("\n");
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
