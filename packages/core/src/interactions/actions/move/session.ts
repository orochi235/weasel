import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { DRAG_THRESHOLD_PX, isAnchorOrControl, resolveParams } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { IDENTITY_POSE_COMPOSITION, type PoseComposition } from 'core/scene/composePose';
import { gesturePlaneReader, gestureViewReader } from '../../gestures/shared/screenTolerance';
import type { GestureContext, MoveBehavior } from '../../gestures/types';
import type { LayoutDep, NodeAtPointDep } from '../depSchema';
import type { GeometryProjection } from '../geometryProjection';
import { commitGestureOps, readGestureLifecycle, type GestureLifecycle } from '../gestureLifecycle';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { moveSources } from '../selectionSubtree';
import { layoutDrop } from './behaviors/layoutDrop';
import { reparentOnDrop } from './behaviors/reparentOnDrop';
import { buildGestureContext, captureFrames, capturePlaneRefs, captureStartPoses } from './capture';
import { moveGestureAdapter, type MoveGestureAdapter } from './gestureAdapter';

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
  /** The binding's behaviors, then the ones the action adds: a layout drop
   *  when the `layout` dep is present, and reparent-on-drop. */
  readonly behaviors: readonly MoveBehavior<unknown>[];
  /** Reused across the drag; behaviors mutate its `scratch`. */
  readonly gestureCtx: GestureContext<unknown>;
  readonly adapter: MoveGestureAdapter<unknown>;
  readonly layout: LayoutDep | undefined;
  readonly applyOps?: (ops: Op[], label: string) => void;
  readonly geometryProjection?: GeometryProjection;
  readonly lifecycle: GestureLifecycle;
  readonly nodeAtPoint: NodeAtPointDep | undefined;
  /** Read at release: a binding's params may be a thunk. */
  readonly reparentOnDrop: () => ReparentOnDrop;
  readonly dragThresholdPx: number;
}

/** What one `onMove` produced. Replaced, not mutated, by the next. */
export interface MoveFrame {
  readonly delta: { dx: number; dy: number };
  /** Stored-frame pose of every displaced id, roots and descendants, and of
   *  any other id a behavior posed. */
  readonly previews: Map<NodeId, unknown>;
  /** Ids the behaviors asked to have painted at full opacity. */
  readonly opaque: ReadonlySet<NodeId>;
}

/** What the behaviors the action builds itself read of the drag they belong
 *  to. Neither is readable from `onStart`, which runs before the session
 *  exists. */
export interface MoveGesture {
  session(): MoveSession;
  /** The latest frame: the previous one while an `onMove` is running. */
  frame(): MoveFrame;
}

export interface MoveReaders {
  view: () => GestureContext<unknown>['view'];
  plane: () => GestureContext<unknown>['plane'];
}

/** Capture a drag at press. Null when there is nothing to move. Runs each
 *  behavior's `onStart`. `frame` reads the drag's latest frame, for the
 *  behaviors appended to the binding's own. */
export function beginMove(
  ctx: InvocationCtx,
  opts: BindingOpts | undefined,
  frame: () => MoveFrame,
): { session: MoveSession; readers: MoveReaders } | null {
  const selection = ctx.deps.selection;
  const scene = ctx.deps.scene;
  const projection = poseDescriptorOf(ctx.deps.poseDescriptor);
  const layout = ctx.deps.layout;
  const applyOps = ctx.deps.applyOps;
  const geometryProjection = ctx.deps.geometryProjection;
  // Pose-composition strategy: how the consumer's scene folds local poses
  // up to world (and back). Absent → IDENTITY (absolute-pose: nodes store
  // world coords, parents are grouping-only). Local-pose consumers supply
  // { compose: composeRectPose, decompose: decomposeRectPose }.
  const pc = ctx.deps.poseComposition
    ?? IDENTITY_POSE_COMPOSITION;

  if (!selection || !scene) return null;
  // Anchors sit on the selected body, and this binding ties editAnchors' on
  // specificity; with no mode registry to filter move out, declining is what lets it through.
  if (isAnchorOrControl(ctx.drag?.affordance)) return null;

  const params = resolveParams(opts?.params);
  const expandIds = params?.['expandIds'] as ((ids: string[]) => string[]) | undefined;
  const selected = [...selection.get()] as string[];
  const ids = moveSources(scene, expandIds ? expandIds(selected) : selected) as NodeId[];
  if (ids.length === 0) return null;

  const reflow = layout?.reflow ?? null;
  const { startPoses, cascadeIds, caught } = captureStartPoses(scene, ids, reflow, projection);
  const { carried, frames } = captureFrames(scene, ids, startPoses, pc);

  // Everything a move does beyond translating is a behavior: the binding's
  // own, then the layout drop, then reparent-on-drop. On release the first to
  // answer owns the commit, so each preempts the ones after it.
  const gesture: MoveGesture = { session: () => session, frame };
  const behaviors: MoveBehavior<unknown>[] = [
    ...((opts?.behaviors ?? []) as MoveBehavior<unknown>[]),
    ...(layout ? [layoutDrop(gesture)] : []),
    reparentOnDrop(gesture),
  ];
  const dragThresholdPx = (params?.['dragThresholdPx'] as number | undefined)
    ?? DRAG_THRESHOLD_PX;
  const lifecycle = readGestureLifecycle(params, 'Move', behaviors);
  // A behavior that commits after the gesture has ended, a coast coming to
  // rest, lands its batch the way the gesture's own commit does.
  const adapter = moveGestureAdapter<unknown>(scene, (ops, _label, through) =>
    commitGestureOps({ scene, applyOps, adapter: through }, lifecycle, ops), selection.adapterMethods);
  const readers: MoveReaders = { view: gestureViewReader(ctx.deps), plane: gesturePlaneReader(ctx.deps) };
  const gestureCtx = buildGestureContext(ctx, ids, startPoses, adapter, readers);
  for (const b of behaviors) b.onStart?.(gestureCtx);

  const session: MoveSession = {
    startPoses,
    ids,
    cascadeIds,
    carried,
    frames,
    scene,
    view: ctx.deps.view,
    planeRefs: capturePlaneRefs(scene, ids, ctx.deps.view, frames, startPoses, projection),
    caught,
    projection,
    descriptorOf: nodeDescriptors(scene, projection),
    behaviors,
    gestureCtx,
    adapter,
    layout,
    pc,
    applyOps,
    geometryProjection,
    lifecycle,
    nodeAtPoint: ctx.deps.nodeAtPoint,
    reparentOnDrop: () => (resolveParams(opts?.params)?.['reparentOnDrop'] as ReparentOnDrop | undefined) ?? 'off',
    dragThresholdPx,
  };
  return { session, readers };
}
