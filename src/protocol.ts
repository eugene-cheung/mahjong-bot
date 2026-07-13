/**
 * Mirrors `mahjong-table/bot-sdk` — keep in sync when the engine contract changes.
 */

import type { CommandBody } from "./command.js";

export const SEATS = ["east", "south", "west", "north"] as const;
export type Seat = (typeof SEATS)[number];

export type TileId =
  | `wan-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `tiao-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `bing-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | "east"
  | "south"
  | "west"
  | "north"
  | "red"
  | "green"
  | "white"
  | "mei"
  | "lan"
  | "ju"
  | "zhu"
  | "spring"
  | "summer"
  | "autumn"
  | "winter";

export interface TileInstance {
  instanceId: string;
  tileId: TileId;
}

export interface Meld {
  kind: "chow" | "pung" | "kong";
  tiles: TileId[];
  open: boolean;
  claimedTile?: TileId;
}

export interface HandState {
  seat: Seat;
  concealed: TileInstance[];
  melds: Meld[];
  revealedBonus: TileId[];
}

export interface DiscardEntry {
  seat: Seat;
  tile: TileInstance;
}

export interface WallView {
  live: TileInstance[];
  dead: TileInstance[];
}

export interface DealerState {
  dealer: Seat;
  roundWind: TileId;
  dealerStreak?: number;
}

export type Phase =
  | "idle"
  | "rolling_dice"
  | "breaking_wall"
  | "dealing"
  | "turn_draw"
  | "turn_discard"
  | "claim_window"
  | "resolving_win"
  | "hand_complete"
  | "match_complete";

export interface GameState {
  phase: Phase;
  hands: Record<Seat, HandState>;
  rulesetId: "hong-kong" | "taiwanese";
  handIndex?: number;
  scores?: Record<Seat, number>;
  discards?: DiscardEntry[];
  wall?: WallView;
  dealer?: DealerState;
}

export interface LegalAction {
  command: CommandBody;
  label: string;
}

export interface DecisionPrompt {
  seat: Seat;
  phase: Phase;
  actions: LegalAction[];
  view?: GameState;
}

export interface BotStrategy {
  choose(prompt: DecisionPrompt, rng: () => number): LegalAction;
}
