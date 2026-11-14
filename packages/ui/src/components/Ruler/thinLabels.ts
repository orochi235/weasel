/** A label's horizontal extent along the ruler, and how badly it wants to be shown: lower `rank` wins. */
export interface LabelBox {
  left: number;
  right: number;
  /** Compared first; lower is kept first. An end of the range is `-Infinity`. */
  rank: number;
  /** Breaks a tie in `rank`; higher is kept first. See {@link roundness}. */
  roundness: number;
}

/**
 * Which labels to show, by index: taken in priority order — lowest `rank`,
 * then highest `roundness`, then leftmost — each is kept only if it stays at
 * least `gap` clear of every label already kept. A label of rank
 * `-Infinity` is always kept.
 */
export function thinLabels(boxes: readonly LabelBox[], gap: number): boolean[] {
  const order = boxes
    .map((box, i) => ({ box, i }))
    .sort((a, b) => a.box.rank - b.box.rank || b.box.roundness - a.box.roundness || a.box.left - b.box.left);
  const kept: LabelBox[] = [];
  const shown = boxes.map(() => false);
  for (const { box, i } of order) {
    const clear = kept.every((k) => box.left >= k.right + gap || k.left >= box.right + gap);
    if (box.rank !== -Infinity && !clear) continue;
    kept.push(box);
    shown[i] = true;
  }
  return shown;
}

const STEPS = (() => {
  const steps: number[] = [];
  for (let k = -9; k <= 9; k++) for (const c of [1, 2, 5]) steps.push(c * 10 ** k);
  for (let d = 2; d <= 64; d++) steps.push(1 / d);
  return steps.sort((a, b) => b - a);
})();

/**
 * The coarsest step `value` is a whole multiple of, from 1·2·5 × 10ⁿ and
 * 1/2 … 1/64: 50 → 50, 40 → 20, 0.25 → 1/4, 1/12 → 1/12. A larger result is a
 * rounder number, which keeps its label longer when the ruler is crowded.
 */
export function roundness(value: number): number {
  if (value === 0) return Infinity;
  const v = Math.abs(value);
  for (const step of STEPS) {
    const n = v / step;
    if (n > 1e6) break;
    if (n >= 0.5 && Math.abs(n - Math.round(n)) < 1e-6) return step;
  }
  return 0;
}
