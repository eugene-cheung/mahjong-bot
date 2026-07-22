import type { LegalAction } from "../protocol.js";
import { tileToIndex } from "../tiles.js";
import type { EncodedLegalAction } from "./records.js";

export function encodeLegalAction(action: LegalAction, id: number, ev: number): EncodedLegalAction {
  // JSON cannot represent ±Infinity; keep training rows finite.
  const finiteEv = Number.isFinite(ev) ? ev : ev > 0 ? 1e6 : -1e6;
  const cmd = action.command;
  const base: EncodedLegalAction = { id, type: cmd.type, ev: finiteEv };

  if (cmd.type === "discard") {
    return { ...base, inst: cmd.instanceId };
  }
  if (cmd.type === "pung" || cmd.type === "kong") {
    const idx = tileToIndex(cmd.tileId);
    return { ...base, tile: idx >= 0 ? idx : undefined };
  }
  if (cmd.type === "chow") {
    const idx = tileToIndex(cmd.meld.claimedTile ?? cmd.meld.tiles[0] ?? "wan-1");
    return { ...base, tile: idx >= 0 ? idx : undefined };
  }
  return base;
}

export function findActionIndex(actions: LegalAction[], chosen: LegalAction): number {
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]!;
    if (a.command.type !== chosen.command.type) continue;
    if (a.command.type === "discard" && chosen.command.type === "discard") {
      if (a.command.instanceId === chosen.command.instanceId) return i;
      continue;
    }
    if (a.label === chosen.label) return i;
    if (JSON.stringify(a.command) === JSON.stringify(chosen.command)) return i;
  }
  return 0;
}
