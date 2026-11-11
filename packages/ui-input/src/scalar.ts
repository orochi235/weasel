/** A box on a surface, by its top-left corner and size. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `v` held to `lo`..`hi`. `lo` wins when the bounds cross; `NaN` passes through. */
export function clamp(v: number, lo: number, hi: number): number {
  const c = v > hi ? hi : v;
  return c < lo ? lo : c;
}
