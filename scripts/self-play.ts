/**
 * Self-play data collection — v2 JSONL with softmax exploration.
 * Usage: npm run self-play
 *
 * Env: MATCHES, MAX_ACTIONS, MAX_HANDS, OUT, TEMPERATURE, DETERMINISTIC=1
 */

import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Table } from "mahjong-table/match/table";
import { createDefaultMatchConfig } from "mahjong-table/match/config";
import { BotPlayer } from "mahjong-table/seats/bot";
import type { Seat } from "mahjong-table/bot-sdk";

import {
  createSelfPlayStrategy,
  handEndRecord,
  matchEndRecord,
  type SelfPlayRecordV2,
} from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEATS: Seat[] = ["east", "south", "west", "north"];
const MATCHES = Number(process.env.MATCHES ?? 3);
/** High enough for a full 4-hand match; table still emits match_complete if capped. */
const MAX_ACTIONS = Number(process.env.MAX_ACTIONS ?? 2500);
const MAX_HANDS = Number(process.env.MAX_HANDS ?? 4);
const OUT = process.env.OUT ?? path.join(__dirname, "..", "data", "self-play.jsonl");
const TEMPERATURE = Number(process.env.TEMPERATURE ?? 1.2);
const DETERMINISTIC = process.env.DETERMINISTIC === "1";

function zeroScores(): Record<Seat, number> {
  return { east: 0, south: 0, west: 0, north: 0 };
}

async function runMatch(seed: number, write: (entry: SelfPlayRecordV2) => void): Promise<void> {
  const matchId = `self-play-${seed}`;
  const config = createDefaultMatchConfig("hong-kong", "east", { maxHands: MAX_HANDS });
  config.seed = seed;
  config.matchId = matchId;
  config.seats = SEATS.map((seat) => ({
    seat,
    kind: "bot" as const,
    displayName: `Bot-${seat}`,
  })) as typeof config.seats;

  let decisionIndex = 0;
  let handIndex = 0;
  let scoresBeforeHand = zeroScores();
  let matchStartScores = zeroScores();
  let initialWall = 80;
  let handsPlayed = 0;
  let matchStartCaptured = false;
  let matchEnded = false;

  const table = new Table(config, (seat, _kind, displayName) => {
    const strategy = createSelfPlayStrategy({
      matchId,
      onLog: write,
      temperature: TEMPERATURE,
      deterministic: DETERMINISTIC,
      getDecisionIndex: () => decisionIndex,
      bumpDecisionIndex: () => {
        decisionIndex++;
      },
      getInitialWall: () => initialWall,
    });
    return new BotPlayer(seat, displayName, strategy);
  });

  table.bus.subscribe((event) => {
    if (event.type === "hand_started") {
      handIndex = event.handIndex;
      scoresBeforeHand = { ...table.engine.getState().scores };
      initialWall = table.engine.getState().wall?.live.length ?? 80;
      if (!matchStartCaptured) {
        matchStartScores = { ...scoresBeforeHand };
        matchStartCaptured = true;
      }
    }
    if (event.type === "hand_scored") {
      handsPlayed++;
      write(
        handEndRecord(
          matchId,
          handIndex,
          event.result.winner,
          event.result.units,
          event.result.updatedScores,
          scoresBeforeHand,
        ),
      );
    }
    if (event.type === "match_complete") {
      matchEnded = true;
      write(
        matchEndRecord(matchId, event.finalScores, matchStartScores, handsPlayed),
      );
    }
    if (event.type === "hand_scored" || event.type === "hand_complete") {
      table.ackHandResult();
    }
  });

  await table.start({ maxActions: MAX_ACTIONS });

  // Belt-and-suspenders: never leave a match without match_end (joinRewards needs it).
  if (!matchEnded) {
    write(
      matchEndRecord(matchId, table.engine.getState().scores, matchStartScores, handsPlayed),
    );
  }
}

async function main(): Promise<void> {
  const outDir = path.dirname(OUT);
  mkdirSync(outDir, { recursive: true });

  const stream = createWriteStream(OUT, { flags: "a" });
  const write = (entry: SelfPlayRecordV2) => {
    stream.write(`${JSON.stringify(entry)}\n`);
  };

  console.log(`Self-play v2 → ${OUT}`);
  console.log(
    `  matches=${MATCHES} maxHands=${MAX_HANDS} maxActions=${MAX_ACTIONS} temperature=${TEMPERATURE} deterministic=${DETERMINISTIC}`,
  );

  for (let i = 0; i < MATCHES; i++) {
    process.stderr.write(`  match ${i + 1}/${MATCHES}…\n`);
    await runMatch(50_000 + i, write);
  }

  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
