import type { DropVerdict } from './dropVerdict';
import type { LayoutDropTargetMode, LayoutStrategy, ReflowTransition } from '../../layout/types';

/**
 * Layout-strategy lookup by container id, consumed by `moveAction` to run
 * the drag-time reflow pass. Sourced by `<SceneCanvas>` from the layout each
 * container declares on its scene node. `getLayout` returns null for a
 * container that declares none, so the reflow pass is a no-op then.
 */
export interface LayoutDep {
  getLayout(containerId: string): LayoutStrategy<unknown> | null;
  /** Which container wins when several contain the drop point. Default
   *  `'innermost'`. */
  dropTarget?: LayoutDropTargetMode;
  /** Carries displaced siblings to their slots over time. Absent, they snap. */
  reflow?: ReflowTransition<unknown> | null;
}

/**
 * Whether the nodes `ids` may be dropped into the container `parent`. A move
 * consults it before reparenting anything. Where it answers `false`,
 * reparent-on-drop passes over the container to the nearest one around it
 * that admits them, and the layout drop treats a layout container as if it
 * were not there. Where it answers a `DropRefusal`, a drag over the container
 * draws it refused with the reason beside the pointer, and a release there
 * moves nothing. Absent, every container takes any drop.
 */
export type CanDropIntoDep = (parent: string, ids: readonly string[]) => DropVerdict;
