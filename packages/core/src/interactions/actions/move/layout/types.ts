import type { NodeId } from 'core/scene/types';
import type { MoveRefusal } from '../refusal';
import type { StrategyView } from 'core/scene/strategyView';
import type {
  LayoutStrategy,
  LayoutContainer,
  LayoutChild,
  LayoutDragged,
  DropTarget as LayoutDropTarget,
} from '../../../../layout/types';

/** Where one dragged child landed, and the container state it landed against,
 *  in the strategy's space (`LayoutPass.view`).
 *  Holding the snapshot is what lets the commit replay the same sequence the
 *  preview showed, rather than re-deriving it from a scene the earlier
 *  placements never wrote to. */
export interface LayoutPlacement {
  dragged: LayoutDragged<unknown>;
  children: LayoutChild<unknown>[];
  target: LayoutDropTarget<unknown>;
}

/** Resolved layout drop for the latest onMove frame. Only set when a layout
 *  container accepted every member of the selection (non-null snap target for
 *  each). One placement per dragged child, in selection order. */
export interface LayoutPass {
  layout: LayoutStrategy<unknown>;
  container: LayoutContainer;
  /** The container as the strategy sees it; its `toWorld` takes what `commitDrop` returns to world. */
  view: StrategyView<unknown>;
  placements: LayoutPlacement[];
  /** Source-container leftovers that actually moved (id → new pose). */
  sourceReflow: Map<string, unknown>;
  /** Siblings reflowing into their destination slots, from both containers.
   *  Surfaced as `previewOpaqueIds` so they paint settled rather than as
   *  ghosts under the pointer. */
  reflowIds: Set<NodeId>;
}

/** One frame's layout result. `dropCenter` is set whenever anything was
 *  dragged, whether or not a container took the drop. */
export interface DropPass {
  dropCenter: { x: number; y: number };
  /** Null when no container accepted every member of the selection. */
  pass: LayoutPass | null;
  /** Displaced siblings' poses this frame, in each one's stored frame. */
  reflow: Map<NodeId, unknown>;
  /** The container under the drop that refuses it with a reason. */
  refused?: MoveRefusal;
}
