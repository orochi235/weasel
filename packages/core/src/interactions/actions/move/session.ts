import type { BindingOpts, InvocationCtx, OngoingOverlay } from '@weasel-js/routing';
import { isPathEditPart, resolveParams } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { PoseComposition } from 'core/scene/composePose';
import { gestureReaders, type GestureReaders } from '../../gestures/shared/screenTolerance';
import type { GestureContext, MoveBehavior } from '../../gestures/types';
import type { CanDropIntoDep, LayoutDep, NodeAtPointDep } from '../depSchema';
import { childVerdict } from '../admitsChild';
import type { DropVerdict } from '../dropVerdict';
import type { GeometryProjection } from '../geometryProjection';
import { commitGestureOps, readGestureLifecycle, type GestureLifecycle } from '../gestureLifecycle';
import { transformFinisher, type TransformFinisher } from '../transformFinish';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { moveSources } from '../selectionSubtree';
import { layoutDrop } from './behaviors/layoutDrop';
import { reparentOnDrop } from './behaviors/reparentOnDrop';
import { buildGestureContext, captureFrames, capturePlaneRefs, captureStartPoses } from './capture';
import { moveGestureAdapter, type MoveGestureAdapter } from './gestureAdapter';
import type { SnapSession } from '../snapDep';
import { lazySnapSession } from 'domains/snap/lazySession';

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
  /** Finishes the committed batch with the other nodes that change with it. */
  readonly finish?: TransformFinisher;
  readonly geometryProjection?: GeometryProjection;
  readonly lifecycle: GestureLifecycle;
  readonly nodeAtPoint: NodeAtPointDep | undefined;
  /** Whether a node takes the dragged roots; with no `canDropInto`, a group does and a mark does not. */
  readonly verdict: (parent: NodeId) => DropVerdict;
  /** Whether {@link verdict} lets them land. */
  readonly admits: (parent: NodeId) => boolean;
  /** Whether a `canDropInto` dep is there to refuse with a reason. */
  readonly mayRefuse: boolean;
  /** Read at release: a binding's params may be a thunk. */
  readonly reparentOnDrop: () => ReparentOnDrop;
  /** The drag's snapping, begun once the drag passes its threshold; null
   *  with no `snap` dep. */
  readonly snap: SnapSession | null;
  /** The press, in the coordinates the drag's delta is measured in. */
  readonly press: { x: number; y: number };
}

/** What one `onMove` produced. Replaced, not mutated, by the next. */
export interface MoveFrame {
  readonly delta: { dx: number; dy: number };
  /** Stored-frame pose of every displaced id, roots and descendants, and of
   *  any other id a behavior posed. */
  readonly previews: Map<NodeId, unknown>;
  /** Ids the behaviors asked to have painted at full opacity. */
  readonly opaque: ReadonlySet<NodeId>;
  /** What the behaviors asked to have painted beside the drag. */
  readonly overlays: readonly OngoingOverlay[];
}

/** What the behaviors the action builds itself read of the drag they belong
 *  to. Neither is readable from `onStart`, which runs before the session
 *  exists. */
export interface MoveGesture {
  session(): MoveSession;
  /** The latest frame: the previous one while an `onMove` is running. */
  frame(): MoveFrame;
}

function verdictOf(
  canDropInto: CanDropIntoDep | undefined,
  ids: readonly NodeId[],
  scene: { get(id: NodeId): { kind: string } | undefined },
): (parent: NodeId) => DropVerdict {
  const roots = ids as readonly string[];
  return (parent) => childVerdict(scene, parent, roots, canDropInto);
}

/** Capture a drag at press. Null when there is nothing to move. Runs each
 *  behavior's `onStart`. `frame` reads the drag's latest frame, for the
 *  behaviors appended to the binding's own. */
export function beginMove(
  ctx: InvocationCtx,
  opts: BindingOpts | undefined,
  frame: () => MoveFrame,
): { session: MoveSession; readers: GestureReaders } | null {
  const selection = ctx.deps.selection;
  const scene = ctx.deps.scene;
  const projection = poseDescriptorOf(ctx.deps.poseDescriptor);
  const layout = ctx.deps.layout;
  const applyOps = ctx.deps.applyOps;
  const geometryProjection = ctx.deps.geometryProjection;
  const finish = transformFinisher(ctx.deps);

  if (!selection || !scene) return null;
  const pc = scene.composition;
  // Anchors, segments, and balance grips sit on the selected body, and this binding ties the
  // path-edit drags' on specificity; with no mode registry to filter move out, declining is what
  // lets them through.
  if (isPathEditPart(ctx.drag?.affordance)) return null;

  const params = resolveParams(opts?.params);
  const expandIds = params?.['expandIds'] as ((ids: string[]) => string[]) | undefined;
  const selected = [...selection.get()] as string[];
  const ids = moveSources(scene, expandIds ? expandIds(selected) : selected) as NodeId[];
  if (ids.length === 0) return null;

  const reflow = layout?.reflow ?? null;
  const { startPoses, cascadeIds, caught } = captureStartPoses(scene, ids, reflow, projection);
  const { carried, frames } = captureFrames(scene, ids, startPoses);

  // Everything a move does beyond translating is a behavior: the binding's
  // own, then the layout drop, then reparent-on-drop. On release the first to
  // answer owns the commit, so each preempts the ones after it.
  const gesture: MoveGesture = { session: () => session, frame };
  const behaviors: MoveBehavior<unknown>[] = [
    ...((opts?.behaviors ?? []) as MoveBehavior<unknown>[]),
    ...(layout ? [layoutDrop(gesture)] : []),
    reparentOnDrop(gesture),
  ];
  const lifecycle = readGestureLifecycle(params, 'Move', behaviors);
  // A behavior that commits after the gesture has ended, a coast coming to
  // rest, lands its batch the way the gesture's own commit does.
  const adapter = moveGestureAdapter<unknown>(scene, (ops, _label, through) =>
    commitGestureOps({ scene, applyOps, adapter: through, finish }, lifecycle, ops), selection.adapterMethods);
  const readers = gestureReaders(ctx.deps);
  const gestureCtx = buildGestureContext(ctx, scene, ids, startPoses, adapter, readers);
  for (const b of behaviors) b.onStart?.(gestureCtx);

  const press = ctx.drag?.start ?? ctx.world;
  const verdict = verdictOf(ctx.deps.canDropInto, ids, scene);
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
    finish,
    geometryProjection,
    lifecycle,
    nodeAtPoint: ctx.deps.nodeAtPoint,
    verdict,
    admits: (parent) => verdict(parent) === true,
    mayRefuse: ctx.deps.canDropInto !== undefined,
    reparentOnDrop: () => (resolveParams(opts?.params)?.['reparentOnDrop'] as ReparentOnDrop | undefined) ?? 'off',
    snap: lazySnapSession(ctx.deps.snap, { gesture: 'move', ids, press, constrain: 'axis' }),
    press,
  };
  return { session, readers };
}
