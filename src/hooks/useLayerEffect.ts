import { type RefObject, useEffect } from 'react';
import { setupCanvasDpr } from '../pixelDensity';

/**
 * Effect that DPR-scales a canvas to `width x height` (CSS px) and calls
 * `renderFn` (or clears it when `visible` is false).
 *
 * `dpr` is optional — when omitted, defaults to `window.devicePixelRatio` via
 * `setupCanvasDpr`. Pass `1` (or call `useFixedPixelRatio()` and forward it)
 * to opt out of DPR scaling.
 */
export function useLayerEffect(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  width: number,
  height: number,
  visible: boolean,
  renderFn: (ctx: CanvasRenderingContext2D) => void,
  deps: unknown[],
  dpr?: number,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const ctx = canvas.getContext('2d')!;
    setupCanvasDpr(canvas, ctx, width, height, { dpr });
    if (visible) {
      renderFn(ctx);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, width, height, dpr, visible, ...deps]);
}
