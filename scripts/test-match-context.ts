/**
 * Match context weight adjustment tests.
 */

import { resolveWeights } from "../src/eval/match-context.js";
import { PROFILES } from "../src/eval/profiles.js";
import type { GameState } from "../src/protocol.js";
import { assertGt, assertLt, section } from "./lib/test-helpers.js";

function view(scores: GameState["scores"], handIndex: number): GameState {
  return {
    phase: "turn_discard",
    rulesetId: "hong-kong",
    handIndex,
    scores,
    hands: { east: { seat: "east", concealed: [], melds: [], revealedBonus: [] }, south: { seat: "south", concealed: [], melds: [], revealedBonus: [] }, west: { seat: "west", concealed: [], melds: [], revealedBonus: [] }, north: { seat: "north", concealed: [], melds: [], revealedBonus: [] } },
    dealer: { dealer: "east", roundWind: "east" },
  };
}

section("leading late match → safer");

const leading = resolveWeights("balanced", view({ east: 50, south: 10, west: 5, north: -65 }, 7), "east", 8);
const base = PROFILES.balanced;

assertGt("leading late increases danger weight", leading.danger, base.danger);
assertLt("leading late reduces fan chase", leading.fan, base.fan);

section("trailing late match → chase fan");

const trailing = resolveWeights("balanced", view({ east: -40, south: 30, west: 20, north: -10 }, 7), "east", 8);

assertGt("trailing late increases fan weight", trailing.fan, base.fan);
assertLt("trailing late reduces danger", trailing.danger, base.danger);

section("mid match unchanged-ish");

const mid = resolveWeights("balanced", view({ east: 0, south: 0, west: 0, north: 0 }, 2), "east", 8);
assertLt("early match fan not boosted much", Math.abs(mid.fan - base.fan), 0.5);

console.log("\nAll match-context tests passed");
