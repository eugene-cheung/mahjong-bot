/**
 * Verify mahjong-table engine always supplies a complete bot view.
 */

import { GameEngine } from "mahjong-table/core/engine";
import { rulesetRegistry } from "mahjong-table/rules/index";
import type { Command } from "mahjong-table/bot-sdk";
import type { Seat } from "../src/protocol.js";
import { assertTrue, section } from "./lib/test-helpers.js";

const SEATS: Seat[] = ["east", "south", "west", "north"];

function firstAction(engine: GameEngine, seat: Seat): Command | null {
  const prompt = engine.decisionPrompt(seat);
  if (!prompt || prompt.actions.length === 0) return null;
  const body = prompt.actions[0]!.command;
  return { ...body, seat } as Command;
}

function autoplayToPrompt(maxSteps = 120) {
  const engine = new GameEngine({
    matchId: "view-test",
    ruleset: rulesetRegistry.get("hong-kong")!,
    seed: 99_001,
  });
  engine.startHand();

  for (let step = 0; step < maxSteps; step++) {
    for (const seat of SEATS) {
      const prompt = engine.decisionPrompt(seat);
      if (prompt?.view && prompt.actions.length > 0) {
        return prompt;
      }
    }

    let acted = false;
    for (const seat of SEATS) {
      const cmd = firstAction(engine, seat);
      if (!cmd) continue;
      engine.apply(cmd);
      acted = true;
      break;
    }
    if (!acted) break;
  }
  return null;
}

section("engine decisionPrompt view contract");

const prompt = autoplayToPrompt();
assertTrue("engine produces a decision prompt", prompt !== null);
assertTrue("view includes scores", prompt!.view!.scores !== undefined);
assertTrue("view includes wall", prompt!.view!.wall !== undefined);
assertTrue("view includes dealer", prompt!.view!.dealer !== undefined);
assertTrue("view includes discards array", Array.isArray(prompt!.view!.discards));
assertTrue("view includes all hands", SEATS.every((s) => prompt!.view!.hands[s] !== undefined));
assertTrue("view includes rulesetId", prompt!.view!.rulesetId === "hong-kong");
assertTrue("view wall has live pile", (prompt!.view!.wall?.live.length ?? 0) > 0);

console.log("\nAll view-contract tests passed");
