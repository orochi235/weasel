/** Round `value` to the nearest multiple of `cellSize`. Returns 0 when the result would be -0. A value that is not
 *  finite, a cell size that is not a positive finite number (as a grid pitch must be), or a value whose multiple
 *  overflows comes back as it was. */
export function roundToCell(value: number, cellSize: number): number {
  const cells = value / cellSize;
  const r = Math.round(cells) * cellSize;
  if (!(cellSize > 0 && cellSize < Infinity) || !Number.isFinite(r)) return Object.is(value, -0) ? 0 : value;
  return r || 0;
}
