import type { ActionDeps } from '@weasel-js/routing';
import type { Affine } from '@weasel-js/geom';
import { translatePoseViaDescriptor, type PoseDescriptor, type TranslateLead } from 'core/geometry/poseDescriptor';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import { geometryDataOp, type GeometryProjection } from './geometryProjection';
import { nodeDescriptors, poseDescriptorOf } from './poseDescriptorDep';
import { scenePoseFrame } from './poseFrame';
import { moveSources, storedDelta, translateTargets } from './selectionSubtree';
import { commitTransformOps } from './transformFinish';

type AnyScene = Scene<unknown, string, unknown>;

/** The deps {@link moveNodes} reads; an action calling it declares these. */
export const MOVE_NODES_REQUIRES = [
  'scene', 'selection', 'applyOps', 'poseDescriptor', 'geometryProjection', 'transformFollowers',
] as const;

/**
 * One transform op per id, translating its authored pose by the stored-frame
 * delta `deltaOf` gives it, plus its data-held geometry's op when a
 * `geometryProjection` is wired. An id `deltaOf` answers null for is skipped,
 * and one it answers with a `lead` is translated with it.
 * Every translate commit — a drag, a nudge, {@link moveNodes} — builds its ops here.
 */
export function translateNodeOps(
  scene: AnyScene,
  ids: Iterable<NodeId>,
  deltaOf: (id: NodeId) => { dx: number; dy: number; lead?: TranslateLead<unknown> } | null,
  descriptorOf: (id: NodeId) => PoseDescriptor<unknown>,
  geometryProjection: GeometryProjection | undefined,
  label: string,
): Op[] {
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    const l = deltaOf(id);
    if (!l) continue;
    // The authored pose, not the effective one: a derived node's effective
    // pose is its derivation, and writing that back would lose the
    // placeholder undo restores.
    const from = node.pose;
    const to = translatePoseViaDescriptor(from, l.dx, l.dy, descriptorOf(id), l.lead);
    ops.push(createTransformOp<unknown>({ id: id as string, from, to, label }));
    const m: Affine = [1, 0, 0, 1, l.dx, l.dy];
    const dataOp = geometryDataOp(geometryProjection, { id: id as string, data: node.data, pose: from }, m, to, label);
    if (dataOp) ops.push(dataOp);
  }
  return ops;
}

/**
 * The ops that move `ids` by `delta` the way a drag of them commits: each id
 * that is not itself derived (a derived one is moved through what it derives
 * from) and every descendant not carried by a moving frame, each translated in
 * the frame it is stored in. `delta` is in the coordinates a gesture's points
 * are — world on a 2D canvas — and the `poseDescriptor` dep turns it into each
 * pose's translation, so a 3D host's descriptor lands it on the node's plane.
 */
export function moveNodesOps(
  scene: AnyScene,
  ids: readonly string[],
  delta: { dx: number; dy: number },
  deps?: Pick<ActionDeps, 'poseDescriptor' | 'geometryProjection'>,
  label = 'Move',
): Op[] {
  const { dx, dy } = delta;
  if (dx === 0 && dy === 0) return [];
  const descriptorOf = nodeDescriptors(scene, poseDescriptorOf(deps?.poseDescriptor));
  const frame = scenePoseFrame(scene);
  const sources = moveSources(scene, ids);
  const targets = translateTargets(scene, frame, sources);
  // The first one stored in world space leads the rest, as in a drag.
  const inWorld = targets.filter((id) => frame.frame(id) === null);
  const first = inWorld.find((id) => id === sources[0]) ?? inWorld[0];
  const from = first === undefined ? undefined : scene.get(first)?.pose;
  const lead: TranslateLead<unknown> | undefined = first === undefined || from === undefined
    ? undefined
    : { from, to: translatePoseViaDescriptor(from, dx, dy, descriptorOf(first)) };
  return translateNodeOps(
    scene,
    targets,
    (id) => frame.frame(id) === null && lead ? { dx, dy, lead } : storedDelta(frame, descriptorOf(id), id, dx, dy),
    descriptorOf,
    deps?.geometryProjection,
    label,
  );
}

/**
 * Move `ids` by `delta` the way a drag of them commits ({@link moveNodesOps}),
 * finished by the `transformFollowers` and committed as one undo entry through
 * `applyOps`, else the scene. Inside an open `scene.batch` it joins that
 * batch's entry. Returns whether anything moved. A caller running as an
 * action declares {@link MOVE_NODES_REQUIRES}.
 */
export function moveNodes(
  deps: ActionDeps,
  ids: readonly string[],
  delta: { dx: number; dy: number },
  label = 'Move',
): boolean {
  const scene = deps.scene as AnyScene | undefined;
  if (!scene) return false;
  const ops = moveNodesOps(scene, ids, delta, deps, label);
  return ops.length > 0 && commitTransformOps(deps, ops, label);
}
