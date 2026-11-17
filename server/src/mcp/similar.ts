/** Lower-cased, punctuation and spaces removed: "Soy-Sauce Chicken!" -> "soysaucechicken". */
export function normalizeName(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

/** Same name, one containing the other, or a small typo apart. */
export function isSimilar(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const shorter = Math.min(x.length, y.length);
  if (shorter >= 3 && (x.includes(y) || y.includes(x))) return true;
  return Math.max(x.length, y.length) >= 5 && levenshtein(x, y) <= 2;
}
