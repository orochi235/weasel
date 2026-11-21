/** Frames per second over a run of frame times in ms: frames over the time they took, not the mean of per-frame rates. */
export function frameRate(deltas: readonly number[]): number {
  if (deltas.length === 0) return 0;
  const sum = deltas.reduce((acc, n) => acc + n, 0);
  return sum > 0 ? Math.round((1000 * deltas.length) / sum) : 0;
}
