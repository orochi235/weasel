import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { zoomAt } from '../../features/viewport/zoomAt';

export interface WheelZoomToolOpts {
  min?: number;
  max?: number;
  /** Multiplicative step per 100px of wheel delta. Default 1.1. */
  wheelStep?: number;
}

/**
 * Always-on tool: claims wheel events when `ctrlKey` is true (covers
 * Cmd+wheel on macOS *and* trackpad pinch, which the browser synthesizes
 * as ctrl+wheel). Zoom anchors at the cursor; uses {@link zoomAt}.
 *
 * Register via `useTools({ ambient: [useWheelZoomTool()] })`.
 */
export function useWheelZoomTool(opts: WheelZoomToolOpts = {}): Tool<null> {
  const { min, max } = opts;
  const wheelStep = opts.wheelStep ?? 1.1;
  return useMemo(
    () =>
      defineTool<null>({
        id: 'wheel-zoom',
        initScratch: () => null,
        wheel: {
          onWheel: (e, ctx) => {
            if (!e.ctrlKey) return 'pass';
            e.preventDefault();
            const rect = ctx.canvasRect;
            const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            const factor = Math.pow(wheelStep, -e.deltaY / 100);
            ctx.setView(zoomAt(ctx.view, anchor, factor, { min, max }));
            return 'claim';
          },
        },
      }),
    [min, max, wheelStep],
  );
}
