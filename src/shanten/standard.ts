/** Standard 4-sets + pair shanten (excluding seven pairs / thirteen orphans). */

export function standardShantenCounts(source: Uint8Array, openMentsu: number): number {
  const hand = Array.from(source);
  let min = 8;

  const search = (index: number, mentsu: number, taatsu: number, pair: boolean): void => {
    while (index < 34 && hand[index] === 0) index++;
    if (index === 34) {
      const m = mentsu + openMentsu;
      const t = taatsu;
      const p = pair ? 1 : 0;
      let s = 8 - 2 * m - p - Math.min(t, Math.max(0, 4 - m));
      if (!pair) {
        s = Math.min(s, 8 - 2 * m - Math.min(t + 1, Math.max(0, 4 - m)));
      }
      min = Math.min(min, s);
      return;
    }

    if (hand[index] > 0) {
      hand[index]--;
      search(index, mentsu, taatsu, pair);
      hand[index]++;
    }

    if (hand[index] >= 3) {
      hand[index] -= 3;
      search(index, mentsu + 1, taatsu, pair);
      hand[index] += 3;
    }

    if (!pair && hand[index] >= 2) {
      hand[index] -= 2;
      search(index, mentsu, taatsu, true);
      hand[index] += 2;
    }

    if (index < 27 && index % 9 <= 6 && hand[index] > 0 && hand[index + 1] > 0 && hand[index + 2] > 0) {
      hand[index]--;
      hand[index + 1]--;
      hand[index + 2]--;
      search(index, mentsu + 1, taatsu, pair);
      hand[index]++;
      hand[index + 1]++;
      hand[index + 2]++;
    }

    if (index < 27 && index % 9 <= 7 && hand[index] > 0 && hand[index + 1] > 0) {
      hand[index]--;
      hand[index + 1]--;
      search(index, mentsu, taatsu + 1, pair);
      hand[index]++;
      hand[index + 1]++;
    }

    if (index < 27 && index % 9 <= 6 && hand[index] > 0 && hand[index + 2] > 0) {
      hand[index]--;
      hand[index + 2]--;
      search(index, mentsu, taatsu + 1, pair);
      hand[index]++;
      hand[index + 2]++;
    }
  };

  search(0, 0, 0, false);
  return min;
}
