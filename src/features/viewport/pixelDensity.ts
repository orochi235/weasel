/**
 * Resize a canvas's backing store for the current `devicePixelRatio` and
 * pre-apply a dpr-scaling transform so subsequent draw calls operate in CSS
 * pixels. Call at the top of every render effect — re-runs are cheap when
 * the dimensions haven't changed (we skip the assignment, which would
 * otherwise reset the bitmap).
 *
 * Returns the dpr in case the caller wants it for further math.
 *
 * To opt out (e.g., pixel-art rendering, deterministic snapshot tests), pass
 * `{ dpr: 1 }` or wire it via `useFixedPixelRatio()`:
 *
 *   const dpr = useFixedPixelRatio();
 *   setupCanvasDpr(c, ctx, W, H, { dpr });
 */
export interface SetupCanvasDprOptions {
  /** Override the dpr used. Defaults to `window.devicePixelRatio || 1`. */
  dpr?: number;
}

/** Resize a canvas's backing store for the current `devicePixelRatio` and pre-scale the context to draw in CSS pixels. */
export function setupCanvasDpr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  options: SetupCanvasDprOptions = {},
): number {
  const dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const targetW = Math.round(cssWidth * dpr);
  const targetH = Math.round(cssHeight * dpr);
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
}

/**
 * Opt-out hook for DPR scaling. Returns `1` so callers can explicitly force
 * 1:1 CSS-pixel-to-buffer-pixel rendering:
 *
 *   const dpr = useFixedPixelRatio();
 *   setupCanvasDpr(c, ctx, W, H, { dpr });
 *
 * Useful for pixel-art demos, deterministic snapshots, or anywhere the
 * dpr-multiplied buffer would interfere.
 */
export function useFixedPixelRatio(): number {
  return 1;
}
