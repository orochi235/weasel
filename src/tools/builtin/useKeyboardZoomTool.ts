import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { zoomAt } from '../../features/viewport/zoomAt';
import { useViewTween } from '../../features/viewport/useViewTween';
import type { View } from '../../features/viewport/view';

export interface KeyboardZoomToolOpts {
  min?: number;
  max?: number;
  /** Multiplicative step per Cmd+= / Cmd+- press. Default 1.25. */
  keyStep?: number;
  /** Animate zoom transitions with a tween. Default false. */
  animate?: boolean;
}

/**
 * Always-on tool: claims `Cmd+=` (zoom in), `Cmd+-` (zoom out), `Cmd+0`
 * (reset). Anchors zoom at the canvas center. Treats `metaKey` and
 * `ctrlKey` interchangeably for cross-platform support.
 *
 * Register via `useTools({ ambient: [useKeyboardZoomTool()] })`.
 */
export function useKeyboardZoomTool(opts: KeyboardZoomToolOpts = {}): Tool<null> {
  const { min, max, animate = false } = opts;
  const keyStep = opts.keyStep ?? 1.25;

  const setViewRef = useRef<((v: View) => void) | null>(null);
  const tween = useViewTween((v) => setViewRef.current?.(v));
  const { animateTo } = tween;

  return useMemo(
    () =>
      defineTool<null>({
        id: 'keyboard-zoom',
        initScratch: () => null,
        keyboard: {
          onDown: (e, ctx) => {
            if (!(e.metaKey || e.ctrlKey)) return 'pass';
            setViewRef.current = ctx.setView;
            const rect = ctx.canvasRect;
            const center = { x: rect.width / 2, y: rect.height / 2 };

            let target: View | null = null;
            if (e.key === '=' || e.key === '+') {
              e.preventDefault();
              target = zoomAt(ctx.view, center, keyStep, { min, max });
            } else if (e.key === '-' || e.key === '_') {
              e.preventDefault();
              target = zoomAt(ctx.view, center, 1 / keyStep, { min, max });
            } else if (e.key === '0') {
              e.preventDefault();
              target = { x: 0, y: 0, scale: 1 };
            }

            if (!target) return 'pass';
            if (animate) {
              const duration = e.key === '0' ? 350 : 200;
              animateTo(ctx.view, target, { duration });
            } else {
              ctx.setView(target);
            }
            return 'claim';
          },
        },
      }),
    [min, max, keyStep, animate, animateTo],
  );
}
