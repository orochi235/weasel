import { useMemo } from 'react';
import { defineViewportTool, claim, none } from '../../routing';
import type { Tool } from '../../types';
import { zoomAt } from 'core/viewport/zoomAt';
import type { ZoomFactor } from 'core/viewport/view';

export interface WheelZoomToolOpts {
  min?: number;
  max?: number;
  /** Multiplicative step per 100px of wheel delta. Default 1.1. */
  wheelStep?: number;
  /**
   * When true (default), only zoom on ctrl/meta+wheel (covers trackpad pinch).
   * Set to false to zoom on any wheel event — appropriate for viewport-first
   * canvases where drag-to-pan replaces scroll-to-pan.
   */
  requireCtrl?: boolean;
  /**
   * Which axes the wheel event zooms.
   * - `'both'` (default): uniform zoom on both axes.
   * - `'x'`: zoom only the x axis (y scale unchanged).
   * - `'y'`: zoom only the y axis (x scale unchanged).
   *
   * Modifier-key bindings (e.g. shift+wheel → x-only) are intentionally not
   * baked into the kit — register a separate tool instance with a `when`
   * predicate, or wrap this tool, to express that policy.
   */
  axis?: 'both' | 'x' | 'y';
}

/**
 * Always-on tool: claims wheel events to zoom about the cursor.
 *
 * By default (`requireCtrl: true`) only fires on ctrl/meta+wheel, which covers
 * both Cmd+wheel and Mac trackpad pinch (synthesized as ctrl+wheel by the
 * browser). Set `requireCtrl: false` to claim all wheel events — useful in
 * viewport-aware canvases where scroll-to-pan is replaced by drag-to-pan.
 *
 * Register via `useTools({ ambient: [useWheelZoomTool()] })`.
 */
export function useWheelZoomTool(opts: WheelZoomToolOpts = {}): Tool<null> {
  const { min, max, requireCtrl = true } = opts;
  const wheelStep = opts.wheelStep ?? 1.1;
  const axis = opts.axis ?? 'both';
  return useMemo(
    () =>
      defineViewportTool<null>({
        id: 'wheel-zoom',
        presentation: { label: 'Zoom (wheel)', group: 'view' },
        initial: {
          wheel: (ctx, event) => {
            const e = event as WheelEvent;
            if (requireCtrl && !e.ctrlKey) return none();
            e.preventDefault();
            const rect = ctx.canvasRect;
            const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            const factor = Math.pow(wheelStep, -e.deltaY / 100);
            const zf: ZoomFactor =
              axis === 'both'
                ? factor
                : axis === 'x'
                  ? { x: factor, y: 1 }
                  : { x: 1, y: factor };
            ctx.setView(zoomAt(ctx.view, anchor, zf, { min, max }));
            return claim();
          },
        },
      }) as Tool<null>,
    [min, max, wheelStep, requireCtrl, axis],
  );
}
