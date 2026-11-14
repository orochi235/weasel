export function rollingAverage(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sum = samples.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / samples.length);
}
