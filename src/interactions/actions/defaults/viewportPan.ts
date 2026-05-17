/**
 * `viewportPanAction` — immediate Action descriptor for wheel-based viewport pan.
 *
 * ## Bindings
 * - Plain wheel (no mod) → pan by deltaX/deltaY
 *
 * ## Design notes
 * The dispatcher merges wheel event data (deltaX, deltaY, clientX, clientY)
 * into params at dispatch time (option (a) from Phase 8.5 design). The invoker
 * reads them from the params bag.
 *
 * Pan delta is divided by view.scale so that one screen-pixel scroll equals
 * one screen-pixel pan at any zoom level.
 *
 * The descriptor does NOT replicate inertia or axis-locking from
 * `useWheelPanTool` — those are opt-in features for specialist use-cases.
 * The canonical viewport pan exposed here uses the simple immediate-action path.
 */

import type { Action } from '../registry';
import type { ViewApi } from '../depSchema';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `viewport.pan` Action.
 *
 * Requires dep-schema entry: `view`.
 */
export const viewportPanAction: Action & { requires: string[] } = {
  id: 'viewport.pan',
  label: 'Pan',
  /**
   * Plain wheel (no modifier) → pan.
   * Cmd+wheel is claimed by `viewportZoomAction`; this binding fires only
   * when ctrlKey is NOT held (handled by the matcher's strict modifier check:
   * omitting `mods` means no modifiers may be held).
   */
  gestureBinding: { kind: 'wheel' },
  requires: ['view'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const view = deps.view as ViewApi | undefined;
      if (!view) return;
      const deltaX = (params?.deltaX as number | undefined) ?? 0;
      const deltaY = (params?.deltaY as number | undefined) ?? 0;
      const current = view.get();
      // Divide by scale so one screen-pixel scroll = one screen-pixel pan.
      const dx = deltaX / current.scale.x;
      const dy = deltaY / current.scale.y;
      view.set({ ...current, x: current.x + dx, y: current.y + dy });
    },
  },
  enabled: () => true,
};
