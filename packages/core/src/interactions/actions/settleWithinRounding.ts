/**
 * `target`, or `current` when the two differ by no more than rounding at
 * `scale`, the largest magnitude the arithmetic behind `target` went through:
 * a move that small is an artifact of that arithmetic, and committing it would
 * record an undo step that changes nothing visible.
 */
export function settleWithinRounding(current: number, target: number, scale: number): number {
  return Math.abs(target - current) <= Math.max(1, Math.abs(scale)) * 1e-9 ? current : target;
}
