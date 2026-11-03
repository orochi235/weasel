/** Where a pixel's quantization error goes: offset and weight numerator. */
export type Kernel = readonly (readonly [dx: number, dy: number, weight: number])[];

export const FLOYD_STEINBERG: Kernel = [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]];

/** Spreads 6/8 of the error, which keeps highlights and shadows clean. */
export const ATKINSON: Kernel = [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]];

/** Error diffusion over `gray`, which it consumes. A protected pixel quantizes
 *  at `threshold` against a value nothing diffused into, and sends no error. */
export function diffuse(
  gray: Float32Array,
  width: number,
  height: number,
  threshold: number,
  kernel: Kernel,
  denominator: number,
  protect: Uint8Array | null,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = gray[i]!;
      const ink = old < threshold;
      mask[i] = ink ? 1 : 0;
      if (protect?.[i]) continue;
      const err = old - (ink ? 0 : 255);
      for (const [dx, dy, w] of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (protect?.[ni]) continue;
        gray[ni] = gray[ni]! + (err * w) / denominator;
      }
    }
  }
  return mask;
}
