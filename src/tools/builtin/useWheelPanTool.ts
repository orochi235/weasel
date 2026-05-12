import { useMemo } from 'react';
import { defineViewportTool, claim, none } from '../routing';
import type { Tool } from '../types';

/**
 * Always-on tool: claims wheel events when `ctrlKey` is false (plain wheel
 * + horizontal trackpad scroll). Translates the view by
 * `(deltaX / view.scale, deltaY / view.scale)` so a one-screen-pixel scroll
 * pans the view by one screen pixel regardless of zoom.
 *
 * Register via `useTools({ ambient: [useWheelPanTool()] })`.
 */
export function useWheelPanTool(): Tool<null> {
  return useMemo(
    () =>
      defineViewportTool<null>({
        id: 'wheel-pan',
        initial: {
          wheel: (ctx, event) => {
            const e = event as WheelEvent;
            if (e.ctrlKey) return none();
            e.preventDefault();
            const v = ctx.view;
            ctx.setView({
              x: v.x + e.deltaX / v.scale,
              y: v.y + e.deltaY / v.scale,
              scale: v.scale,
            });
            return claim();
          },
        },
      }) as Tool<null>,
    [],
  );
}
