/**
 * `viewportDragPanAction` — ongoing Action descriptor for drag-to-pan the viewport.
 *
 * ## Bindings
 * - Plain drag (any target) → pan the viewport in screen space
 *
 * ## Design notes
 * The drag delta from the dispatcher is in screen space (pixels). The pan
 * formula mirrors `useHandTool`:
 *
 *   newView.x = startView.x - screenDx
 *   newView.y = startView.y - screenDy
 *
 * where `screenDx` / `screenDy` are the screen-space pixel deltas from the
 * drag origin. This keeps one screen-pixel drag equal to one screen-pixel pan
 * at any zoom level (the "camera" moves opposite to the drag direction so that
 * the scene content appears to follow the pointer).
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
export const viewportDragPanAction: Action & { requires: string[] } = {
  id: 'viewport.dragPan',
  label: 'Drag to pan viewport',
  gestureBinding: { kind: 'drag' },
  requires: ['view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const view = ctx.deps.view as ViewApi | undefined;
      if (!view) return {};

      const startView = view.get();
      const scratch: DragPanScratch = { startView, view };

      return {
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          // drag.delta is in screen space (pixels). Subtract directly from the
          // start view's camera position — this matches useHandTool's convention
          // where `view.x - screenDx` shifts the scene content in the drag direction.
          const { x: screenDx, y: screenDy } = moveCtx.drag.delta;
          const sv = scratch.startView;
          scratch.view.set({
            ...sv,
            x: sv.x - screenDx,
            y: sv.y - screenDy,
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
