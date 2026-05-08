import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { View } from '../../features/viewport/view';
import { useVelocityTracker } from '../../features/viewport/useVelocityTracker';
import { useDecayLoop, type PanBounds } from '../../features/viewport/useDecayLoop';

export interface InertiaConfig {
  friction?: number;
  minSpeed?: number;
  /** What to do when inertial pan reaches `bounds`. Default: no clamping. */
  boundary?: 'stop' | 'bounce';
  /** View-coordinate limits for boundary clamping. Requires `boundary` to take effect. */
  bounds?: PanBounds;
}

export interface UseHandToolOptions {
  inertia?: false | InertiaConfig;
}

interface HandScratch {
  startView: View;
  startClientX: number;
  startClientY: number;
}

/**
 * Pan-on-drag tool. Registered in both the active slot (sticky, `H` key)
 * and the hotkey slot (momentary, hold `space`).
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
export function useHandTool(opts: UseHandToolOptions = {}): Tool<HandScratch | null> {
  const inertia = opts.inertia === false ? false : opts.inertia;
  const tracker = useVelocityTracker();
  const decay = useDecayLoop();
  const setViewRef = useRef<((v: View) => void) | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });

  return useMemo(
    () =>
      defineTool<HandScratch | null>({
        id: 'hand',
        keybinding: 'H',
        hotkey: 'space',
        initScratch: () => null,
        cursor: (ctx) => (ctx.scratch ? 'grabbing' : 'grab'),
        drag: {
          onStart: (e, ctx) => {
            decay.cancel();
            tracker.reset();
            setViewRef.current = ctx.setView;
            viewRef.current = ctx.view;
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
            const newView = {
              x: ctx.scratch.startView.x - dx,
              y: ctx.scratch.startView.y - dy,
              scale: ctx.scratch.startView.scale,
            };
            if (inertia) {
              tracker.record(newView.x - viewRef.current.x, newView.y - viewRef.current.y, Date.now());
            }
            viewRef.current = newView;
            setViewRef.current = ctx.setView;
            ctx.setView(newView);
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            ctx.scratch = null;
            if (inertia) {
              setViewRef.current = ctx.setView;
              viewRef.current = ctx.view;
              const velocity = tracker.getVelocity();
              decay.start({
                velocity,
                friction: inertia.friction,
                minSpeed: inertia.minSpeed,
                boundary: inertia.boundary,
                viewBounds: inertia.bounds,
                initialPosition: { x: viewRef.current.x, y: viewRef.current.y },
                onTick: (dvx, dvy) => {
                  const v = viewRef.current;
                  const next = { x: v.x + dvx, y: v.y + dvy, scale: v.scale };
                  viewRef.current = next;
                  setViewRef.current?.(next);
                },
              });
            }
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
            decay.cancel();
          },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertia, tracker, decay],
  );
}
