/**
 * EV scorer simulation and decision tests.
 */

import {
  pickBestAction,
  scoreAction,
  simulateClaim,
  simulateDiscard,
  snapshotHand,
} from "../src/eval/ev-scorer.js";
import { TileTracker } from "../src/eval/tile-tracker.js";
import { PROFILES } from "../src/eval/profiles.js";
import type { DecisionPrompt, GameState, LegalAction, Seat, TileId } from "../src/protocol.js";
import { assertEq, assertGt, assertLt, assertTrue, section } from "./lib/test-helpers.js";

function tile(id: TileId, instanceId: string) {
  return { instanceId, tileId: id };
}

function viewForEast(handTiles: Array<{ id: TileId; inst: string }>, overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "turn_discard",
    rulesetId: "hong-kong",
    handIndex: 2,
    scores: { east: 0, south: 0, west: 0, north: 0 },
    wall: { live: Array.from({ length: 50 }, (_, i) => tile("wan-1", `w-${i}`)), dead: [] },
    discards: [],
    dealer: { dealer: "east", roundWind: "east" },
    hands: {
      east: {
        seat: "east",
        concealed: handTiles.map((t) => tile(t.id, t.inst)),
        melds: [],
        revealedBonus: [],
      },
      south: { seat: "south", concealed: [], melds: [], revealedBonus: [] },
      west: { seat: "west", concealed: [], melds: [], revealedBonus: [] },
      north: { seat: "north", concealed: [], melds: [], revealedBonus: [] },
    },
    ...overrides,
  };
}

section("simulateDiscard removes correct instance");

const dupView = viewForEast([
  { id: "wan-5", inst: "a" },
  { id: "wan-5", inst: "b" },
  { id: "wan-6", inst: "c" },
  { id: "wan-7", inst: "d" },
  { id: "wan-8", inst: "e" },
  { id: "wan-9", inst: "f" },
  { id: "bing-1", inst: "g" },
  { id: "bing-2", inst: "h" },
  { id: "bing-3", inst: "i" },
  { id: "tiao-4", inst: "j" },
  { id: "tiao-5", inst: "k" },
  { id: "tiao-6", inst: "l" },
  { id: "east", inst: "m" },
  { id: "south", inst: "n" },
]);

const afterDiscard = simulateDiscard(dupView, "east", "a", []);
assertTrue("discard removes one wan-5", afterDiscard !== null && afterDiscard.concealed.filter((t) => t === "wan-5").length === 1);

section("simulateClaim pung");

const pungHand = {
  concealed: ["wan-2", "wan-2", "wan-3", "wan-4", "wan-5", "wan-6", "wan-7", "bing-1", "bing-2", "tiao-3", "tiao-4"] as TileId[],
  melds: [] as const,
};
const pungAction: LegalAction = {
  command: { type: "pung", tileId: "wan-2" },
  label: "Pung wan-2",
};
const afterPung = simulateClaim(pungHand, pungAction);
assertTrue("pung removes 2 from hand", afterPung !== null && afterPung.concealed.filter((t) => t === "wan-2").length === 0);
assertEq("pung adds meld", afterPung!.melds.length, 1);
assertEq("pung removes two tiles from concealed", afterPung!.concealed.length, pungHand.concealed.length - 2);

section("simulateClaim chow skips claimed tile");

const chowHand = {
  concealed: ["wan-3", "wan-4", "wan-7", "wan-8", "bing-1", "bing-2", "tiao-3", "tiao-4", "east", "south", "red"] as TileId[],
  melds: [] as const,
};
const chowAction: LegalAction = {
  command: {
    type: "chow",
    meld: { kind: "chow", tiles: ["wan-3", "wan-4", "wan-5"], open: true, claimedTile: "wan-5" },
  },
  label: "Chow",
};
const afterChow = simulateClaim(chowHand, chowAction);
assertTrue("chow removes 2 hand tiles", afterChow !== null && !afterChow.concealed.includes("wan-3") && !afterChow.concealed.includes("wan-4"));
assertEq("chow meld stored", afterChow!.melds[0]?.kind, "chow");

section("simulateClaim open kong requires 3 in hand");

const kongHand = {
  concealed: ["bing-9", "bing-9", "bing-9", "wan-1", "wan-2", "wan-3", "wan-4", "wan-5", "wan-6", "wan-7", "wan-8"] as TileId[],
  melds: [] as const,
};
const kongOk: LegalAction = { command: { type: "kong", tileId: "bing-9", concealed: false }, label: "Kong" };
const kongBad: LegalAction = { command: { type: "kong", tileId: "wan-1", concealed: false }, label: "Kong" };
assertTrue("open kong with 3 in hand succeeds", simulateClaim(kongHand, kongOk) !== null);
assertTrue("open kong without 3 in hand fails", simulateClaim(kongHand, kongBad) === null);

section("simulateClaim add-kong promotes open pung");

const addKongHand = {
  concealed: ["bing-9", "wan-1", "wan-2", "wan-3", "wan-4", "wan-5", "wan-6", "wan-7", "wan-8", "east"] as TileId[],
  melds: [{ kind: "pung" as const, tiles: ["bing-9", "bing-9", "bing-9"] as TileId[], open: true, claimedTile: "bing-9" as TileId }],
};
const addKong: LegalAction = { command: { type: "kong", tileId: "bing-9", concealed: false }, label: "Add Kong" };
const afterAdd = simulateClaim(addKongHand, addKong);
assertTrue("add-kong removes one from hand", afterAdd !== null && !afterAdd.concealed.includes("bing-9"));
assertEq("add-kong upgrades pung to kong", afterAdd!.melds[0]?.kind, "kong");
assertEq("add-kong keeps one meld", afterAdd!.melds.length, 1);

section("scoreAction prioritizes hu");

const promptHu: DecisionPrompt = {
  seat: "east",
  phase: "claim_window",
  actions: [
    { command: { type: "pass_claim" }, label: "Pass" },
    { command: { type: "hu" }, label: "Hu" },
  ],
  view: dupView,
};
const tracker = TileTracker.fromView(dupView, "east");
const huScore = scoreAction(promptHu, promptHu.actions[1], PROFILES.balanced, tracker);
const passScore = scoreAction(promptHu, promptHu.actions[0], PROFILES.balanced, tracker);
assertGt("hu beats pass", huScore, passScore);

section("pickBestAction prefers lower shanten discard");

const discardView = viewForEast([
  { id: "wan-1", inst: "1" },
  { id: "wan-2", inst: "2" },
  { id: "wan-3", inst: "3" },
  { id: "wan-4", inst: "4" },
  { id: "wan-5", inst: "5" },
  { id: "wan-6", inst: "6" },
  { id: "wan-7", inst: "7" },
  { id: "wan-8", inst: "8" },
  { id: "bing-1", inst: "9" },
  { id: "bing-1", inst: "10" },
  { id: "bing-1", inst: "11" },
  { id: "tiao-9", inst: "12" },
  { id: "tiao-9", inst: "13" },
  { id: "east", inst: "14" },
]);

const discardPrompt: DecisionPrompt = {
  seat: "east",
  phase: "turn_discard",
  actions: discardView.hands.east.concealed.map((t) => ({
    command: { type: "discard" as const, instanceId: t.instanceId },
    label: `Discard ${t.tileId}`,
  })),
  view: discardView,
};

const bestDiscard = pickBestAction(discardPrompt, PROFILES.speed);
assertTrue(
  "speed profile dumps isolated honor",
  bestDiscard.command.type === "discard" && bestDiscard.command.instanceId === "14",
);

section("safe discard preferred under threat");

const threatView = viewForEast(
  [
    { id: "wan-5", inst: "safe" },
    { id: "wan-2", inst: "1" },
    { id: "wan-3", inst: "2" },
    { id: "wan-4", inst: "3" },
    { id: "wan-6", inst: "4" },
    { id: "wan-7", inst: "5" },
    { id: "wan-8", inst: "6" },
    { id: "bing-5", inst: "7" },
    { id: "bing-5", inst: "8" },
    { id: "tiao-1", inst: "9" },
    { id: "tiao-2", inst: "10" },
    { id: "tiao-3", inst: "11" },
    { id: "east", inst: "12" },
    { id: "red", inst: "14" },
  ],
  {
    discards: [
      { seat: "south", tile: tile("wan-5", "d1") },
      { seat: "south", tile: tile("wan-5", "d2") },
      { seat: "west", tile: tile("wan-5", "d3") },
    ],
    hands: {
      ...viewForEast([]).hands,
      east: {
        seat: "east",
        concealed: [
          tile("wan-5", "safe"),
          tile("wan-2", "1"),
          tile("wan-3", "2"),
          tile("wan-4", "3"),
          tile("wan-6", "4"),
          tile("wan-7", "5"),
          tile("wan-8", "6"),
          tile("bing-5", "7"),
          tile("bing-5", "8"),
          tile("tiao-1", "9"),
          tile("tiao-2", "10"),
          tile("tiao-3", "11"),
          tile("east", "12"),
          tile("red", "14"),
        ],
        melds: [],
        revealedBonus: [],
      },
      south: {
        seat: "south",
        concealed: [],
        melds: [
          { kind: "pung", tiles: ["tiao-5", "tiao-5", "tiao-5"], open: true },
          { kind: "pung", tiles: ["bing-3", "bing-3", "bing-3"], open: true },
        ],
        revealedBonus: [],
      },
      west: { seat: "west", concealed: [], melds: [{ kind: "pung", tiles: ["wan-1", "wan-1", "wan-1"], open: true }], revealedBonus: [] },
      north: { seat: "north", concealed: [], melds: [], revealedBonus: [] },
    },
  },
);

const threatPrompt: DecisionPrompt = {
  seat: "east",
  phase: "turn_discard",
  actions: threatView.hands.east.concealed.map((t) => ({
    command: { type: "discard" as const, instanceId: t.instanceId },
    label: `Discard ${t.tileId}`,
  })),
  view: threatView,
};

const safeDiscard = pickBestAction(threatPrompt, PROFILES.defensive);
assertTrue("defensive chooses discard action", safeDiscard.command.type === "discard");
const safeTile = threatView.hands.east.concealed.find(
  (t) => safeDiscard.command.type === "discard" && t.instanceId === safeDiscard.command.instanceId,
)?.tileId;
assertEq("defensive dumps exhausted wan-5", safeTile, "wan-5");

section("post-claim discard is scored");

// Claiming a pung of wan-2 leaves an awkward 11-tile hand; forced discard matters.
const claimView = viewForEast([
  { id: "wan-2", inst: "a" },
  { id: "wan-2", inst: "b" },
  { id: "wan-5", inst: "c" },
  { id: "bing-1", inst: "d" },
  { id: "bing-3", inst: "e" },
  { id: "bing-7", inst: "f" },
  { id: "tiao-1", inst: "g" },
  { id: "tiao-4", inst: "h" },
  { id: "tiao-8", inst: "i" },
  { id: "east", inst: "j" },
  { id: "south", inst: "k" },
  { id: "west", inst: "l" },
  { id: "red", inst: "m" },
]);
const claimPrompt: DecisionPrompt = {
  seat: "east",
  phase: "claim_window",
  actions: [
    { command: { type: "pass_claim" }, label: "Pass" },
    { command: { type: "pung", tileId: "wan-2" }, label: "Pung" },
  ],
  view: claimView,
};
const claimTracker = TileTracker.fromView(claimView, "east");
const pungEv = scoreAction(claimPrompt, claimPrompt.actions[1], PROFILES.balanced, claimTracker);
const passEv = scoreAction(claimPrompt, claimPrompt.actions[0], PROFILES.balanced, claimTracker);
assertTrue("pung EV is finite", Number.isFinite(pungEv));
assertTrue("pass EV is finite", Number.isFinite(passEv));
// Scattered hand: opening for wan-2 should not wildly outscore staying closed.
assertTrue("claim EV does not explode vs pass", pungEv < passEv + 20);

section("snapshotHand roundtrip");

const snap = snapshotHand(discardView, "east");
assertEq("snapshot concealed count", snap.concealed.length, 14);

console.log("\nAll ev-scorer tests passed");
