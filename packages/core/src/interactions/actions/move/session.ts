import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { PoseComposition } from 'features/groups/composePose';
import type { GestureContext, MoveBehavior } from '../../gestures/types';
import type { LayoutDep, NodeAtPointDep } from '../depSchema';
import type { GeometryProjection } from '../geometryProjection';
import type { GestureLifecycle } from '../gestureLifecycle';
import type { MoveGestureAdapter } from './gestureAdapter';
import type { LayoutPass } from './layout/types';

/** Allowed values for the `reparentOnDrop` binding param. `'off'` (the
 *  default) preserves the legacy translate-only commit. `'top'` lands the
 *  moved node at the top of the container under the cursor. `'above'`
 *  lands it immediately above the hit sibling in z-order (falls back to
 *  `'top'` semantics when the hit is itself a container or when the hit
 *  and moved node share no parent). */
export type ReparentOnDrop = 'off' | 'top' | 'above';

/** What a move captured at press. Nothing here changes during the drag. */
export interface MoveSession {
  readonly scene: Scene<unknown, string, unknown>;
  /** The drag roots. */
  readonly ids: readonly NodeId[];
  /** Descendants of the roots, previewed along with them. */
  readonly cascadeIds: readonly NodeId[];
  /** Start pose of every root and descendant. */
  readonly startPoses: ReadonlyMap<NodeId, unknown>;
  /** Ids whose frame is itself moving, so they ride it and are not translated. */
  readonly carried: ReadonlySet<NodeId>;
  /** For each moved id stored under a frame: its world pose and the frame's, at press. */
  readonly frames: ReadonlyMap<NodeId, { world: unknown; frameWorld: unknown }>;
  /** Ids grabbed mid-glide, with how far the pose shown stood from the document's. */
  readonly caught: ReadonlyMap<NodeId, { dx: number; dy: number }>;
  /** Per layer on another plane than the edited one: a point of its first root, in both. */
  readonly planeRefs: ReadonlyMap<string, { own: { x: number; y: number }; edited: { x: number; y: number } }>;
  readonly view: unknown;
  readonly projection: PoseDescriptor<unknown>;
  readonly descriptorOf: (id: NodeId | string) => PoseDescriptor<unknown>;
  readonly pc: PoseComposition<unknown>;
  readonly behaviors: readonly MoveBehavior<unknown>[];
  /** Reused across the drag; behaviors mutate its `scratch`. */
  readonly gestureCtx: GestureContext<unknown>;
  readonly adapter: MoveGestureAdapter<unknown>;
  readonly layout: LayoutDep | undefined;
  readonly applyOps?: (ops: Op[], label: string) => void;
  readonly geometryProjection?: GeometryProjection;
  readonly lifecycle: GestureLifecycle;
  readonly nodeAtPoint: NodeAtPointDep | undefined;
  readonly reparentOnDrop: ReparentOnDrop;
  readonly dragThresholdPx: number;
}

/** What one `onMove` produced. Replaced, not mutated, by the next. */
export interface MoveFrame {
  readonly delta: { dx: number; dy: number };
  /** Stored-frame pose of every displaced id, roots and descendants. The
   *  layout pass adds the siblings it displaced. */
  readonly previews: Map<NodeId, unknown>;
}

/** The drag's state that is neither: what it publishes and what the layout
 *  pass last decided. Step 3 of the spec moves the layout half into a behavior. */
export interface MoveLive {
  currentDelta: { dx: number; dy: number };
  previews: Map<NodeId, unknown>;
  overrideEntries: Map<NodeId, { pose: unknown }>;
  reflowTargets: Map<NodeId, unknown>;
  gliding: Set<NodeId>;
  layoutPass: LayoutPass | null;
  dropCenter: { x: number; y: number } | null;
  lastWorld: { x: number; y: number } | null;
}
