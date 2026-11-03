/** The classic 4×4 Bayer index matrix, row-major. The GPU shader embeds this
 *  same array, so the two paths cannot drift. */
export const BAYER_4X4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Rec. 601 luma weights. */
export const LUMA: readonly [number, number, number] = [0.299, 0.587, 0.114];

export const DEFAULT_THRESHOLD = 128;

export const WHITE: readonly [number, number, number] = [255, 255, 255];

/** The gray an ordered dither compares against at dot (x, y): below it is ink. */
export function bayerCutoff(x: number, y: number, threshold: number): number {
  const m = BAYER_4X4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]!;
  return (m + 0.5) * 16 + (threshold - DEFAULT_THRESHOLD);
}
