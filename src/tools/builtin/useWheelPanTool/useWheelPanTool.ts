import { useMemo, useRef } from 'react';
import { defineViewportTool, claim, none } from '../../routing';
import type { Tool } from '../../types';
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
  /**
   * ms of wheel-event silence before the inertia decay loop kicks in.
   * Defaults to 100ms — long enough to ride through most trackpad gaps,
   * short enough to feel responsive on mouse wheels.
   */
  idleMs?: number;
}

export interface UseWheelPanToolOptions {
  /**
   * Off by default — wheel-pan inertia on a trackpad fights the OS
   * momentum scrolling. Flip on for mouse-wheel-only contexts where the
   * kit owns the inertia model.
   */
  inertia?: false | InertiaConfig;
}

/**
 * Always-on tool: claims wheel events when `ctrlKey` is false (plain wheel
 * + horizontal trackpad scroll). Translates the view by
 * `(deltaX / view.scale, deltaY / view.scale)` so a one-screen-pixel scroll
 * pans the view by one screen pixel regardless of zoom.
 *
 * Register via `useTools({ ambient: [useWheelPanTool()] })`.
 *
 * Pass `{ inertia: { ... } }` to continue the pan after wheel events stop.
 * Default-off: trackpads already provide OS momentum scrolling and stacking
 * a second decay loop on top feels broken.
 */
export function useWheelPanTool(opts: UseWheelPanToolOptions = {}): Tool<null> {
  const inertia = opts.inertia === false ? false : opts.inertia;
  const tracker = useVelocityTracker();
  const decay = useDecayLoop();
  // Refs keep the latest setView / current view available to the decay
  // tick callback after wheel events stop.
  const setViewRef = useRef<((v: View) => void) | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useMemo(
    () =>
      defineViewportTool<null>({
        id: 'wheel-pan',
        initial: {
          wheel: (ctx, event) => {
            const e = event as WheelEvent;
            if (e.ctrlKey) return none();
            e.preventDefault();

            // Fresh wheel event — cancel any inertia from the previous
            // session and clear the idle timer.
            if (inertia) {
              decay.cancel();
              if (idleTimerRef.current !== null) {
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
              }
            }

            const v = ctx.view;
            const dx = e.deltaX / v.scale;
            const dy = e.deltaY / v.scale;
            const newView: View = {
              x: v.x + dx,
              y: v.y + dy,
              scale: v.scale,
            };

            if (inertia) {
              tracker.record(dx, dy, Date.now());
              viewRef.current = newView;
              setViewRef.current = ctx.setView;
            }

            ctx.setView(newView);

            if (inertia) {
              const idleMs = inertia.idleMs ?? 100;
              idleTimerRef.current = setTimeout(() => {
                idleTimerRef.current = null;
                const velocity = tracker.getVelocity();
                decay.start({
                  velocity,
                  friction: inertia.friction,
                  minSpeed: inertia.minSpeed,
                  boundary: inertia.boundary,
                  viewBounds: inertia.bounds,
                  initialPosition: { x: viewRef.current.x, y: viewRef.current.y },
                  onTick: (dvx, dvy) => {
                    const cur = viewRef.current;
                    const next: View = {
                      x: cur.x + dvx,
                      y: cur.y + dvy,
                      scale: cur.scale,
                    };
                    viewRef.current = next;
                    setViewRef.current?.(next);
                  },
                  onEnd: () => {
                    tracker.reset();
                  },
                });
              }, idleMs);
            }

            return claim();
          },
        },
      }) as Tool<null>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertia, tracker, decay],
  );
}
