/** Seven pairs shanten — concealed only (13 tiles + 1 draw). */

export function sevenPairsShanten(counts: Uint8Array): number {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 34; i++) {
    const n = counts[i];
    if (n >= 1) kinds++;
    if (n >= 2) pairs++;
    if (n === 4) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}
