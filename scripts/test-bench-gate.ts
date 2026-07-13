/**
 * Regression gate: heuristic bot must beat random over short matches.
 * Usage: MATCHES=3 MAX_ACTIONS=150 tsx scripts/test-bench-gate.ts
 */

import { Table } from "mahjong-table/match/table";
import { createDefaultMatchConfig } from "mahjong-table/match/config";
import { BotPlayer, randomBotStrategy } from "mahjong-table/seats/bot";
import { heuristicStrategy } from "../dist/index.js";
import type { Seat } from "mahjong-table/bot-sdk";
import { assertGte, assertTrue, section } from "./lib/test-helpers.js";

const SEATS: Seat[] = ["east", "south", "west", "north"];
const MATCHES = Number(process.env.MATCHES ?? 3);
const MAX_ACTIONS = Number(process.env.MAX_ACTIONS ?? 350);

async function runMatch(seed: number, heuristicSeat: Seat) {
  const config = createDefaultMatchConfig("hong-kong", "east", { maxHands: 2 });
  config.seed = seed;
  config.seats = SEATS.map((seat) => ({
    seat,
    kind: "bot" as const,
    displayName: seat === heuristicSeat ? "Heuristic" : "Random",
  })) as typeof config.seats;

  const table = new Table(config, (seat, _kind, displayName) =>
    seat === heuristicSeat
      ? new BotPlayer(seat, displayName, heuristicStrategy)
      : new BotPlayer(seat, displayName, randomBotStrategy),
  );

  let heuristicWins = 0;
  table.bus.subscribe((event) => {
    if (event.type === "hand_scored" && event.result.winner === heuristicSeat) heuristicWins++;
    if (event.type === "hand_scored" || event.type === "hand_complete") table.ackHandResult();
  });

  await table.start({ maxActions: MAX_ACTIONS });
  const scores = table.engine.getState().scores;
  const randomScore = SEATS.filter((s) => s !== heuristicSeat).reduce((sum, s) => sum + scores[s], 0);
  return { heuristicWins, heuristicScore: scores[heuristicSeat], randomScore };
}

async function main(): Promise<void> {
  section(`bench gate (${MATCHES} matches)`);

  let hWins = 0;
  let rScoreSum = 0;
  let hScoreSum = 0;

  for (let i = 0; i < MATCHES; i++) {
    const seat = SEATS[i % SEATS.length];
    const r = await runMatch(20_000 + i, seat);
    hWins += r.heuristicWins;
    hScoreSum += r.heuristicScore;
    rScoreSum += r.randomScore;
  }

  console.log(`  Heuristic wins: ${hWins}, score sum: ${hScoreSum}, random score sum: ${rScoreSum}`);

  assertTrue("at least one hand was scored", hWins + Math.abs(hScoreSum) + Math.abs(rScoreSum) > 0);
  assertTrue("heuristic score beats random aggregate", hScoreSum > rScoreSum);
  assertGte("heuristic wins at least one hand", hWins, 1);

  console.log("\nBench gate passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
