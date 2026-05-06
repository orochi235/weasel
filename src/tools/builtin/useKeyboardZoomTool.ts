import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { zoomAt } from '../../features/viewport/zoomAt';

export interface KeyboardZoomToolOpts {
  min?: number;
  max?: number;
  /** Multiplicative step per Cmd+= / Cmd+- press. Default 1.25. */
  keyStep?: number;
}

/**
 * Always-on tool: claims `Cmd+=` (zoom in), `Cmd+-` (zoom out), `Cmd+0`
 * (reset). Anchors zoom at the canvas center. Treats `metaKey` and
 * `ctrlKey` interchangeably for cross-platform support.
 *
 * Register via `useTools({ ambient: [useKeyboardZoomTool()] })`.
 */
export function useKeyboardZoomTool(opts: KeyboardZoomToolOpts = {}): Tool<null> {
  const { min, max } = opts;
  const keyStep = opts.keyStep ?? 1.25;
  return useMemo(
    () =>
      defineTool<null>({
        id: 'keyboard-zoom',
        initScratch: () => null,
        keyboard: {
          onDown: (e, ctx) => {
            if (!(e.metaKey || e.ctrlKey)) return 'pass';
            const rect = ctx.canvasRect;
            const center = { x: rect.width / 2, y: rect.height / 2 };
            if (e.key === '=' || e.key === '+') {
              e.preventDefault();
              ctx.setView(zoomAt(ctx.view, center, keyStep, { min, max }));
              return 'claim';
            }
            if (e.key === '-' || e.key === '_') {
              e.preventDefault();
              ctx.setView(zoomAt(ctx.view, center, 1 / keyStep, { min, max }));
              return 'claim';
            }
            if (e.key === '0') {
              e.preventDefault();
              ctx.setView({ x: 0, y: 0, scale: 1 });
              return 'claim';
            }
            return 'pass';
          },
        },
      }),
    [min, max, keyStep],
  );
}
