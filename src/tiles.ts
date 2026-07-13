import type { TileId } from "./protocol.js";

/** Max copies per suited/honor type in a full deck. */
export const MAX_COPIES = 4;

/** Map suited + honor tiles to 0–33 (flowers/seasons excluded). */
export function tileToIndex(id: TileId): number {
  if (id.startsWith("wan-")) return Number(id.slice(4)) - 1;
  if (id.startsWith("tiao-")) return 9 + Number(id.slice(5)) - 1;
  if (id.startsWith("bing-")) return 18 + Number(id.slice(5)) - 1;
  if (id === "east") return 27;
  if (id === "south") return 28;
  if (id === "west") return 29;
  if (id === "north") return 30;
  if (id === "red") return 31;
  if (id === "green") return 32;
  if (id === "white") return 33;
  return -1;
}

export function indexToTile(index: number): TileId | null {
  if (index >= 0 && index < 9) return `wan-${index + 1}` as TileId;
  if (index >= 9 && index < 18) return `tiao-${index - 8}` as TileId;
  if (index >= 18 && index < 27) return `bing-${index - 17}` as TileId;
  const honors: TileId[] = ["east", "south", "west", "north", "red", "green", "white"];
  const honor = index - 27;
  return honor >= 0 && honor < honors.length ? honors[honor] : null;
}

export function isSuitedIndex(index: number): boolean {
  return index < 27;
}

export function isHonorTile(id: TileId): boolean {
  return tileToIndex(id) >= 27;
}

export function isSuitedTile(id: TileId): boolean {
  return id.startsWith("wan-") || id.startsWith("tiao-") || id.startsWith("bing-");
}

export function parseSuitedTile(id: TileId): { suit: "wan" | "tiao" | "bing"; rank: number } | null {
  if (!isSuitedTile(id)) return null;
  const [suit, rank] = id.split("-") as ["wan" | "tiao" | "bing", string];
  return { suit, rank: Number(rank) };
}

export function countsFromIds(ids: readonly TileId[]): Uint8Array {
  const counts = new Uint8Array(34);
  for (const id of ids) {
    const idx = tileToIndex(id);
    if (idx >= 0) counts[idx]++;
  }
  return counts;
}

export function incCount(counts: Uint8Array, id: TileId, delta = 1): void {
  const idx = tileToIndex(id);
  if (idx >= 0) counts[idx] += delta;
}

export function meldTileIds(meld: { tiles: TileId[] }): TileId[] {
  return [...meld.tiles];
}

export function allMeldTiles(melds: readonly { tiles: TileId[] }[]): TileId[] {
  return melds.flatMap((m) => meldTileIds(m));
}
