import type { Seat } from "./protocol.js";
import type { TileId } from "./protocol.js";
import type { Meld } from "./protocol.js";

export type CommandBody =
  | { type: "draw" }
  | { type: "discard"; instanceId: string }
  | { type: "pung"; tileId: TileId }
  | { type: "chow"; meld: Meld }
  | { type: "kong"; tileId: TileId; concealed: boolean }
  | { type: "hu" }
  | { type: "flower_win" }
  | { type: "pass_claim" };

export type Command = CommandBody & { seat: Seat };
