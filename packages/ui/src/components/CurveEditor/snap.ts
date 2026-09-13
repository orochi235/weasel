/** Snap `value` to the nearest candidate within `tolerance`, else return it. */
export function snapToNearest(value: number, candidates: readonly number[], tolerance: number): number {
  let best = value;
  let bestDist = tolerance;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}
