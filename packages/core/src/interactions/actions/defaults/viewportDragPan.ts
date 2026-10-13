import type { Action } from '@weasel-js/routing';
import { resolveParams, type InvocationCtx, type OngoingHandle, type BindingOpts } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';
import type { InertiaConfig } from 'core/viewport/useDecayLoop';
import { createVelocityTracker, type VelocityTracker } from 'core/viewport/createVelocityTracker';

interface DragPanScratch {
  startView: View;
  /** The view the pan is measured from, and the cumulative screen delta it
   *  was taken at. The press, until something else moves the camera. */
  base: View;
  baseScreen: { x: number; y: number };
  /** The view as this pan last left it. */
  seen: View;
  view: ViewApi;
  axis: 'both' | 'x' | 'y';
  inertia: InertiaConfig | undefined;
  tracker: VelocityTracker | undefined;
  lastScreen: { x: number; y: number };
}

/**
 * Rebuild the client-pixel drag delta from the world one, for an event source
 * that supplied no `clientX`/`clientY`.
 *
 * A world delta is self-referential mid-pan — its two ends were measured under
 * different views — so it cannot simply be scaled. Undoing each end against the
 * view that produced it recovers the client delta exactly, since
 * `world = (client - origin) / scale + view` and neither the canvas origin nor
 * the scale moves during a pan.
 */
function screenDeltaFromWorld(
  drag: NonNullable<InvocationCtx['drag']>,
  scratch: DragPanScratch,
): { x: number; y: number } {
  const v0 = scratch.startView;
  const now = scratch.view.get();
  return {
    x: (drag.current.x - now.x - (drag.start.x - v0.x)) * v0.scale.x,
    y: (drag.current.y - now.y - (drag.start.y - v0.y)) * v0.scale.y,
  };
}

function sameCamera(a: View, b: View): boolean {
  return a === b
    || (a.x === b.x && a.y === b.y && a.scale.x === b.scale.x && a.scale.y === b.scale.y);
}

/** Binding params `viewport.dragPan` understands, read at `start`. A bare
 *  binding pans both axes with no coasting. `inertia` coasts the view after
 *  release through the optional `view.decay` dep; with none wired the pan
 *  simply lands. `true` coasts with the kit defaults. */
export interface DragPanParams {
  axis?: 'both' | 'x' | 'y';
  inertia?: boolean | InertiaConfig;
}

/**
 * @experimental
 * Translates the viewport by the screen-space drag delta so the canvas content
 * follows the pointer. Produces no scene ops — view changes are not undoable.
 * It has no binding of its own: the hand tool binds a drag to it, and a canvas
 * that pans on any unclaimed drag adds `dragPanContribution`.
 */
// No `eligible` field → viewport pan is always eligible across all modes.
export const viewportDragPanAction: Action & { requires: string[] } = {
  id: 'viewport.dragPan',
  label: 'Drag to pan viewport',
  group: 'viewport',
  cursor: 'grab',
  activeCursor: 'grabbing',
  requires: ['view', 'debug'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const view = ctx.deps.view;
      if (!view) return {};

      const startView = view.get();
      // The dispatcher hands the binding's unresolved `opts` here and nowhere
      // else, and pumps `onMove` / `onEnd` with an empty deps bag. Everything
      // the gesture needs has to be captured now.
      const params = (resolveParams(opts?.params) ?? {}) as DragPanParams;
      const inertia = params.inertia === true ? {} : params.inertia || undefined;
      const scratch: DragPanScratch = {
        startView,
        base: startView,
        baseScreen: { x: 0, y: 0 },
        seen: startView,
        view,
        axis: params.axis ?? 'both',
        inertia,
        // Only track when a coast could actually happen, so the common
        // no-inertia drag does no per-move work.
        tracker: inertia && view.decay ? createVelocityTracker() : undefined,
        lastScreen: { x: 0, y: 0 },
      };
      const debug = ctx.deps.debug;
      const grab = ctx.drag?.start;

      return {
        kind: 'pan',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          // Use `screenDelta` (client/CSS pixels), NOT `delta` (world). Pan
          // mutates the view itself, so world deltas are self-referential and
          // halve the apparent movement on every pointermove after the first.
          const screen = moveCtx.drag.screenDelta ?? screenDeltaFromWorld(moveCtx.drag, scratch);
          // An axis lock drops the other component of the *cumulative* delta,
          // so the locked axis never moves however the pointer wanders.
          const screenDx = scratch.axis === 'y' ? 0 : screen.x;
          const screenDy = scratch.axis === 'x' ? 0 : screen.y;
          scratch.tracker?.record(
            screenDx - scratch.lastScreen.x,
            screenDy - scratch.lastScreen.y,
            performance.now(),
          );
          // A zoom or pan from elsewhere while the drag is held (a wheel, a
          // key) is kept: the pan carries on from where it left the camera.
          const now = scratch.view.get();
          if (!sameCamera(now, scratch.seen)) {
            scratch.base = now;
            scratch.baseScreen = scratch.lastScreen;
          }
          scratch.lastScreen = { x: screenDx, y: screenDy };
          const sv = scratch.base;
          const next = {
            ...sv,
            x: sv.x - (screenDx - scratch.baseScreen.x) / sv.scale.x,
            y: sv.y - (screenDy - scratch.baseScreen.y) / sv.scale.y,
          };
          scratch.view.set(next);
          scratch.seen = scratch.view.get();
          debug?.recordViewport('pan', sv, next, grab && { x: grab.x, y: grab.y });
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          // No scene ops to commit; the pan itself is already live. What is
          // left is the coast, and only for a drag that actually ended.
          const { tracker, inertia, view: v } = scratch;
          if (reason === 'cancel' || !tracker || !inertia || !v.decay) return;
          const { vx, vy } = tracker.getVelocity();
          const scale = scratch.base.scale;
          v.decay({
            // Screen px/ms → world units/ms, matching the onMove conversion.
            velocity: { vx: -vx / scale.x, vy: -vy / scale.y },
            friction: inertia.friction,
            minSpeed: inertia.minSpeed,
            boundary: inertia.boundary,
            viewBounds: inertia.bounds,
            initialPosition: { x: v.get().x, y: v.get().y },
            onTick: (dx, dy) => {
              const cur = v.get();
              v.set({ ...cur, x: cur.x + dx, y: cur.y + dy });
            },
          });
        },
      };
    },
  },
  enabled: () => true,
};
