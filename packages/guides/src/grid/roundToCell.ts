/** Round `value` to the nearest multiple of `cellSize`. Returns 0 when the result would be -0. */
export function roundToCell(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize || 0;
}
