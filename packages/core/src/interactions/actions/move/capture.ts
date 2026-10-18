import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { effectivePose } from 'core/scene/effectivePose';
import type { NodeId, Scene } from 'core/scene/types';
import { toPlane } from 'core/viewport/parallax';
import { composesFrames, composeWorldPose, frameAtOrAbove } from 'core/scene/composePose';
import { scenePoseAdapter } from 'core/scene/scenePoseAdapter';
import type { ReflowTransition } from '../../../layout/types';
import type { GestureContext } from '../../gestures/types';
import { invertPlane, planeOf } from '../planeInput';
import { sceneGestureFrames } from '../gestureFrames';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { scenePoseFrame } from '../poseFrame';
import { translateTargets } from '../selectionSubtree';
import type { MoveGestureAdapter } from './gestureAdapter';
import { catchGliding } from './layout/glide';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';

/** Start pose of each root and descendant, the descendants in walk order, and
 *  the offsets of any caught mid-glide. */
export function captureStartPoses(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  reflow: ReflowTransition | null,
  projection: PoseDescriptor<unknown>,
): { startPoses: Map<NodeId, unknown>; cascadeIds: NodeId[]; caught: Map<NodeId, { dx: number; dy: number }> } {
  // Capture origin poses once at drag start. Walk descendants so
  // container drags can preview every displaced child — required by
  // `usePreviewGhostLayer.buildSubtree` which only recurses into ids
  // present in `previewIds()`.
  const startPoses = new Map<NodeId, unknown>();
  const cascadeIds: NodeId[] = [];
  const seen = new Set<NodeId>();
  const queue: NodeId[] = [];
  // A node still gliding from an earlier reflow is held where it is
  // shown, and the drag starts from there.
  const caught = new Map<NodeId, { dx: number; dy: number }>();
  const hold = (id: NodeId): void => {
    const held = catchGliding(scene, reflow, projection, id);
    if (held) caught.set(id, held);
  };
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    hold(id);
    startPoses.set(id, effectivePose(scene, node));
    seen.add(id);
    queue.push(id);
  }
  while (queue.length > 0) {
    const parent = queue.shift()!;
    for (const childId of scene.childrenOf(parent)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      const childNode = scene.get(childId);
      if (!childNode) continue;
      hold(childId);
      startPoses.set(childId, effectivePose(scene, childNode));
      cascadeIds.push(childId);
      queue.push(childId);
    }
  }
  return { startPoses, cascadeIds, caught };
}

/** Which ids ride a moving frame, and the world poses of the rest that sit under one. */
export function captureFrames(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  startPoses: ReadonlyMap<NodeId, unknown>,
): { carried: Set<NodeId>; frames: Map<NodeId, { world: unknown; frameWorld: unknown }> } {
  const carried = new Set<NodeId>();
  const frames = new Map<NodeId, { world: unknown; frameWorld: unknown }>();
  const pc = scene.composition;
  if (!composesFrames(pc)) return { carried, frames };
  const written = new Set(translateTargets(scene, scenePoseFrame(scene), ids));
  const poseAdapter = scenePoseAdapter(scene);
  for (const id of startPoses.keys()) {
    if (!written.has(id)) {
      carried.add(id);
      continue;
    }
    const frame = frameAtOrAbove(poseAdapter, scene.get(id)?.parent ?? null);
    if (frame === null) continue;
    frames.set(id, {
      world: composeWorldPose(poseAdapter, id as string, pc.compose),
      frameWorld: composeWorldPose(poseAdapter, frame, pc.compose),
    });
  }
  return { carried, frames };
}

/** For each layer on another plane: a point of its first root, in its own world and the edited one. */
export function capturePlaneRefs(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  view: unknown,
  frames: ReadonlyMap<NodeId, { world: unknown }>,
  startPoses: ReadonlyMap<NodeId, unknown>,
  projection: PoseDescriptor<unknown>,
): Map<string, { own: { x: number; y: number }; edited: { x: number; y: number } }> {
  const planeRefs = new Map<string, { own: { x: number; y: number }; edited: { x: number; y: number } }>();
  for (const id of ids) {
    const layer = scene.get(id)?.layer;
    if (layer === undefined || planeRefs.has(layer)) continue;
    const m = planeOf(view, layer);
    if (m === null) continue;
    const world = frames.get(id)?.world ?? startPoses.get(id);
    if (world === undefined) continue;
    const b = projection.getBounds(world);
    const own = { x: b.x, y: b.y };
    planeRefs.set(layer, { own, edited: toPlane(invertPlane(m)!, own) });
  }
  return planeRefs;
}

export function buildGestureContext(
  ctx: InvocationCtx,
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  startPoses: ReadonlyMap<NodeId, unknown>,
  adapter: MoveGestureAdapter<unknown>,
  readers: GestureReaders,
): GestureContext<unknown> {
  const origin = new Map<string, unknown>();
  for (const [id, pose] of startPoses) origin.set(id as string, pose);
  const projection = poseDescriptorOf(ctx.deps.poseDescriptor);
  const gestureCtx: GestureContext<unknown> = {
    draggedIds: ids as unknown as string[],
    origin,
    current: new Map(origin),
    snap: null,
    modifiers: { ...ctx.modifiers },
    pointer: pointerStateOf(ctx.world, ctx),
    view: readers.view(),
    plane: readers.plane(),
    kitSettings: readers.kitSettings,
    frames: sceneGestureFrames(scene, ctx.deps),
    offset: (from, to) => {
      const a = projection.getBounds(from);
      const b = projection.getBounds(to);
      return { dx: b.x - a.x, dy: b.y - a.y };
    },
    adapter: adapter as unknown as GestureContext<unknown>['adapter'],
    scratch: {},
  };
  return gestureCtx;
}
