import { useMemo, useRef, createElement } from 'react';
import { defineViewportTool, begin, hold, cancel } from '../../routing';
import type { Tool } from '../../types';
import { HandIcon } from '../../../icons';
import type { View } from 'core/viewport/view';
import { useVelocityTracker } from 'core/viewport/useVelocityTracker';
import { useDecayLoop, type PanBounds } from 'core/viewport/useDecayLoop';

export interface InertiaConfig {
  friction?: number;
  minSpeed?: number;
  /** What to do when inertial pan reaches `bounds`. Default: no clamping. */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** View-coordinate limits for boundary clamping. Requires `boundary` to take effect. */
  bounds?: PanBounds;
}

export interface UseHandToolOptions {
  inertia?: false | InertiaConfig;
}

/** @internal */
interface HandScratch {
  startView: View;
  startScreenPoint: { x: number; y: number };
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
  // Refs keep the latest setView / current view available to the decay
  // tick callback after the gesture ends.
  const setViewRef = useRef<((v: View) => void) | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return useMemo(
    () =>
      defineViewportTool<HandScratch>({
        id: 'hand',
        keybinding: { key: 'H' },
        hotkey: 'space',
        presentation: {
          label: 'Hand',
          icon: createElement(HandIcon),
          group: 'view',
        },
        cursor: 'grab',
        initial: {
          drag: (ctx) => {
            // Cancel any in-flight inertia from a previous gesture.
            decay.cancel();
            tracker.reset();
            setViewRef.current = ctx.setView;
            viewRef.current = ctx.view;
            return begin<HandScratch>({
              scratch: {
                startView: ctx.view,
                startScreenPoint: ctx.screenPoint ?? { x: 0, y: 0 },
              },
              onMove: (ctx) => {
                const screen = ctx.screenPoint ?? { x: 0, y: 0 };
                const dx = screen.x - ctx.scratch.startScreenPoint.x;
                const dy = screen.y - ctx.scratch.startScreenPoint.y;
                const newView: View = {
                  x: ctx.scratch.startView.x - dx,
                  y: ctx.scratch.startView.y - dy,
                  scale: ctx.scratch.startView.scale,
                };
                if (inertia) {
                  tracker.record(
                    newView.x - viewRef.current.x,
                    newView.y - viewRef.current.y,
                    Date.now(),
                  );
                }
                viewRef.current = newView;
                setViewRef.current = ctx.setView;
                ctx.setView(newView);
                return hold(ctx.scratch);
              },
              onRelease: (ctx) => {
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
                      const next: View = {
                        x: v.x + dvx,
                        y: v.y + dvy,
                        scale: v.scale,
                      };
                      viewRef.current = next;
                      setViewRef.current?.(next);
                    },
                  });
                }
                // View changes aren't undoable — exit engaged without applying ops.
                return cancel();
              },
              onCancel: () => {
                decay.cancel();
              },
            });
          },
        },
        engaged: {
          cursor: 'grabbing',
        },
      }) as Tool<HandScratch | null>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertia, tracker, decay],
  );
}
