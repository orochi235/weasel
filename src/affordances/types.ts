import type { DragChannel } from '../tools/types';
import type { ChromeState } from '../core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from '../core/viewport/view';

/**
 * @experimental
 * A single interactive piece of chrome. Pure functions; the kit composes
 * multiple affordances into a single RenderLayer per tool via
 * `composeAffordanceLayer` (Task 5).
 */
export interface Affordance {
  /** Stable id for debug overlays + visibility maps. */
  id: string;
  /** Emit DrawCommands describing this affordance. Reads ChromeState +
   *  view. Returns [] when the affordance shouldn't render (no selection,
   *  multiActive false, etc. — affordance decides). */
  render(state: ChromeState, view: View): DrawCommand[];
  /** Optional. Returns a HitResult if `(worldX, worldY)` lands on this
   *  affordance, null otherwise. Affordances that are non-interactive
   *  (purely decorative) omit this. */
  hitTest?(
    worldX: number,
    worldY: number,
    state: ChromeState,
    view: View,
  ): HitResult | null;
}

/**
 * @experimental
 * Result of a layer's (or affordance's) hit-test. Nominates the gesture's
 * drag channel and (optionally) initial scratch state.
 */
export interface HitResult<TScratch = unknown> {
  drag: DragChannel<TScratch>;
  /** Initial scratch passed to drag.onStart. Lets the affordance pre-fill
   *  state from what its hit-test already computed (anchor: 'br',
   *  targetId: 'g1', etc.) so the tool's onStart doesn't re-hit-test. */
  initialScratch?: TScratch;
}
