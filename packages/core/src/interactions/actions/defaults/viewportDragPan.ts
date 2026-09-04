/**
 * `viewportDragPanAction` — ongoing Action descriptor for drag-to-pan the viewport.
 *
 * ## Bindings
 * - Plain drag (any target) → pan the viewport in screen space
 *
 * ## Design notes
 * The drag delta from the dispatcher is in screen space (pixels). The pan
 * formula converts screen pixels to world units by dividing by zoom:
 *
 *   newView.x = startView.x - screenDx / startView.scale.x
 *   newView.y = startView.y - screenDy / startView.scale.y
 *
 * where `screenDx` / `screenDy` are the screen-space pixel deltas from the
 * drag origin. This ensures that at any zoom level, the drag behavior is
 * consistent: 1 screen pixel always pans the same amount relative to the
 * viewport's zoom (e.g., at 1x zoom: 100px → 100 world units; at 2x zoom:
 * 100px → 50 world units). The camera moves opposite to the drag direction
 * so that the scene content appears to follow the pointer.
 *
 * The descriptor captures `startView` in its own scratch at `start` time,
 * parallel to `useHandTool`'s `startView` capture in its scratch object.
 *
 * ## Axis locking and inertia
 * Both are read from the binding's `params` at `start`, so any consumer
 * binding this action gets them — not just `useHandTool`. `axis` drops one
 * component of every pan delta. `inertia` coasts the view after release,
 * through the optional `view.decay` dep; with no such dep wired the pan
 * simply lands, which is what an unconfigured consumer already expects.
 *
 * @see useHandTool — the React hook this descriptor parallels.
 */

import type { Action } from '../registry';
import { resolveParams, type InvocationCtx, type OngoingHandle, type BindingOpts } from '../invoker';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';
import type { InertiaConfig } from 'core/viewport/useDecayLoop';
import { createVelocityTracker, type VelocityTracker } from 'core/viewport/createVelocityTracker';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface DragPanScratch {
  startView: View;
  view: ViewApi;
  axis: 'both' | 'x' | 'y';
  inertia: InertiaConfig | undefined;
  tracker: VelocityTracker | undefined;
  lastScreen: { x: number; y: number };
}

/** Binding params `viewport.dragPan` understands. `useHandTool` supplies both;
 *  a bare binding supplies neither and pans both axes with no coasting. */
export interface DragPanParams {
  axis?: 'both' | 'x' | 'y';
  inertia?: false | InertiaConfig;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `viewport.dragPan` Action.
 *
 * Requires dep-schema entry: `view`.
 *
 * Translates the viewport by the screen-space drag delta so the canvas content
 * follows the pointer. Produces no scene ops — view changes are not undoable.
 */
// No `eligible` field → viewport pan is always eligible across all modes.
export const viewportDragPanAction: Action & { requires: string[] } = {
  id: 'viewport.dragPan',
  label: 'Drag to pan viewport',
  group: 'viewport',
  defaultBinding: { kind: 'drag' },
  // Hover hint: when this action would win the drag at the hovered point
  // (e.g. empty canvas with no marquee-capable tool ahead of it), the
  // hover-cursor pump shows the open hand.
  cursor: 'grab',
  // ...and the closed hand once the pan is actually running. This was
  // `useHandTool`'s `engaged: { cursor: 'grabbing' }` — a phase-table entry
  // on a tool, which meant a consumer who bound `viewport.dragPan` without
  // the hand tool got no state cursor at all.
  activeCursor: 'grabbing',
  requires: ['view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const view = ctx.deps.view as ViewApi | undefined;
      if (!view) return {};

      const startView = view.get();
      // Gesture-driven ongoing actions never see `ctx.params` — the dispatcher
      // hands the binding's unresolved `opts` here and nowhere else, and pumps
      // `onMove` / `onEnd` with an empty deps bag. Everything the gesture needs
      // has to be captured now.
      const params = (resolveParams(opts?.params) ?? {}) as DragPanParams;
      const inertia = params.inertia === false ? undefined : params.inertia;
      const scratch: DragPanScratch = {
        startView,
        view,
        axis: params.axis ?? 'both',
        inertia,
        // Only track when a coast could actually happen, so the common
        // no-inertia drag does no per-move work.
        tracker: inertia && view.decay ? createVelocityTracker() : undefined,
        lastScreen: { x: 0, y: 0 },
      };

      return {
        kind: 'pan',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          // Use `screenDelta` (client/CSS pixels), NOT `delta` (world). Pan
          // mutates the view itself, so world deltas are self-referential —
          // after the first commit, `toWorld(currentClient)` returns a
          // position offset by the just-applied pan, halving the apparent
          // movement on every subsequent pointermove. Screen coords come
          // straight from the DOM event and don't drift.
          //
          // Fall back to world `delta` only when the dispatcher didn't get
          // clientX/clientY on the event (legacy harnesses); in that case
          // panning at scale 1 still works approximately, and zoom-scale
          // panning will exhibit the lag bug. The fallback exists so old
          // test fixtures continue to compile.
          const screen = moveCtx.drag.screenDelta ?? moveCtx.drag.delta;
          // An axis lock drops the other component of the *cumulative* delta,
          // so the locked axis never moves however the pointer wanders.
          const screenDx = scratch.axis === 'y' ? 0 : screen.x;
          const screenDy = scratch.axis === 'x' ? 0 : screen.y;
          if (scratch.tracker) {
            scratch.tracker.record(
              screenDx - scratch.lastScreen.x,
              screenDy - scratch.lastScreen.y,
              performance.now(),
            );
            scratch.lastScreen = { x: screenDx, y: screenDy };
          }
          const sv = scratch.startView;
          // 1 screen px maps to 1/scale world units (at 2x zoom, 100 px →
          // 50 world units of pan).
          scratch.view.set({
            ...sv,
            x: sv.x - screenDx / sv.scale.x,
            y: sv.y - screenDy / sv.scale.y,
          });
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          // No scene ops to commit; the pan itself is already live. What is
          // left is the coast, and only for a drag that actually ended.
          const { tracker, inertia, view: v } = scratch;
          if (reason === 'cancel' || !tracker || !inertia || !v.decay) return;
          const { vx, vy } = tracker.getVelocity();
          const scale = scratch.startView.scale;
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
