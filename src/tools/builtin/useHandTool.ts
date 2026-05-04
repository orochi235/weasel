import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { View } from '../../features/viewport/view';

interface HandScratch {
  startView: View;
  startClientX: number;
  startClientY: number;
}

/**
 * Pan-on-drag tool. Registered in both the active slot (sticky, `H` key)
 * and the modifier slot (momentary, hold `space`).
 *
 * Drag handlers compute pan deltas inline. View is read from ctx.view at
 * gesture start and written via ctx.setView on every move — so the tool
 * works with both controlled and uncontrolled Canvas viewport modes
 * without any extra wiring.
 *
 * Sign convention: dragging the mouse right moves the canvas content right
 * relative to the viewport — i.e. the camera moves *left*. So the new view
 * is `{ x: startView.x - dx, y: startView.y - dy }`.
 */
export function useHandTool(): Tool<HandScratch | null> {
  return useMemo(
    () =>
      defineTool<HandScratch | null>({
        id: 'hand',
        keybinding: 'H',
        modifier: 'space',
        initScratch: () => null,
        cursor: (ctx) => (ctx.scratch ? 'grabbing' : 'grab'),
        drag: {
          onStart: (e, ctx) => {
            ctx.scratch = {
              startView: ctx.view,
              startClientX: e.clientX,
              startClientY: e.clientY,
            };
            return 'claim';
          },
          onMove: (e, ctx) => {
            if (!ctx.scratch) return 'pass';
            const dx = e.clientX - ctx.scratch.startClientX;
            const dy = e.clientY - ctx.scratch.startClientY;
            ctx.setView({
              x: ctx.scratch.startView.x - dx,
              y: ctx.scratch.startView.y - dy,
            });
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            ctx.scratch = null;
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
          },
        },
      }),
    [],
  );
}
