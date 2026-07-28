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
 * ## Axis locking
 * Not implemented here — this descriptor always pans both axes. Axis-locked
 * variants can be registered as separate descriptors by consumers.
 *
 * ## Inertia
 * Not implemented — the descriptor ends cleanly at `onEnd`. The `useHandTool`
 * hook wires inertia via `useDecayLoop`; that remains available for consumers
 * who need it.
 *
 * @see useHandTool — the React hook this descriptor parallels.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface DragPanScratch {
  startView: View;
  view: ViewApi;
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
    start(ctx: InvocationCtx): OngoingHandle {
      const view = ctx.deps.view as ViewApi | undefined;
      if (!view) return {};

      const startView = view.get();
      const scratch: DragPanScratch = { startView, view };

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
          const { x: screenDx, y: screenDy } = screen;
          const sv = scratch.startView;
          // 1 screen px maps to 1/scale world units (at 2x zoom, 100 px →
          // 50 world units of pan).
          scratch.view.set({
            ...sv,
            x: sv.x - screenDx / sv.scale.x,
            y: sv.y - screenDy / sv.scale.y,
          });
        },
        onEnd(): void {
          // No scene ops to commit; view change is already live.
        },
      };
    },
  },
  enabled: () => true,
};
