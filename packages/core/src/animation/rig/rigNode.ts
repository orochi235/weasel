import { useMemo, useState, useSyncExternalStore } from 'react';
import { poseFrameInverseOf, poseFrameOf } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from '../../core/geometry/poseDescriptor';
import type { NodeId } from '../../core/scene/types';
import type { BindRigOptions, Rig, RigScene } from './bindRig';
import type { Skin } from '@weasel-js/animator';
import type { Skeleton } from '@weasel-js/animator';
import { createRigSeat } from './rigSeat';
import { useSeatedRig } from './useRig';

/** What a rig reads from node data: a `skeleton` on the node that is the rig, and on the nodes
 *  under it a `skin` for a path that bends or a `joint` for a node that rides one whole. */
export interface RigNodeData {
  /** Joints relative to the node's pose: its box's top-left corner, turned as the node is. */
  skeleton?: Skeleton;
  skin?: Skin;
  joint?: string;
}

/** Weights to bind in place of the document's, and word of when they change. `@weasel-js/rig`'s
 *  `RigEditState` is one: it holds what a stroke of the weight tool has painted and not yet written. */
export interface PaintedSkins {
  /** By node. A new map whenever the weights change. */
  painted(): ReadonlyMap<NodeId, Skin>;
  listen(fn: () => void): () => void;
}

/** The part of a scene `rigFromNode` reads. */
export interface RigNodeSource<TPose> {
  get(id: NodeId): { pose: TPose; data?: unknown } | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
}

/** The skeleton, bindings, and skins a rig node declares, as `bindRig` takes them. */
export interface RigNodeParts {
  skeleton: Skeleton;
  bindings: Record<string, NodeId[]>;
  skins: Record<NodeId, Skin>;
}

interface Reading extends RigNodeParts {
  /** Every node, pose, and data object the parts were read from, to tell when they are stale. */
  refs: unknown[];
}

type Affine = readonly [number, number, number, number, number, number];
const through = (m: Affine | null, x: number, y: number): [number, number] =>
  (m ? [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] : [x, y]);

/**
 * A skeleton as a rig node's data keeps it, moved to where the node's pose puts it: its root
 * joints are offset from the pose box's top-left corner and turned as the node is. Joints
 * under a root are relative to their parents and are left as they are.
 */
export function placeSkeleton<TPose>(
  skeleton: Skeleton,
  pose: TPose,
  descriptor: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): Skeleton {
  const box = descriptor.getBounds(pose);
  const frame = poseFrameOf(pose);
  const turn = descriptor.getRotation?.(pose) ?? 0;
  return {
    joints: skeleton.joints.map((joint) => {
      if (joint.parent != null) return joint;
      const [x, y] = through(frame, box.x + joint.bind.x, box.y + joint.bind.y);
      return { ...joint, bind: { ...joint.bind, x, y, rotation: joint.bind.rotation + turn } };
    }),
  };
}

/** The inverse of {@link placeSkeleton}: a skeleton in the scene's space, as the node at
 *  `pose` would keep it in its data. */
export function unplaceSkeleton<TPose>(
  skeleton: Skeleton,
  pose: TPose,
  descriptor: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): Skeleton {
  const box = descriptor.getBounds(pose);
  const inverse = poseFrameInverseOf(pose);
  const turn = descriptor.getRotation?.(pose) ?? 0;
  return {
    joints: skeleton.joints.map((joint) => {
      if (joint.parent != null) return joint;
      const [x, y] = through(inverse, joint.bind.x, joint.bind.y);
      return { ...joint, bind: { ...joint.bind, x: x - box.x, y: y - box.y, rotation: joint.bind.rotation - turn } };
    }),
  };
}

const UNPAINTED: ReadonlyMap<NodeId, Skin> = new Map();
const noWord = (): (() => void) => () => {};
const unpainted = (): ReadonlyMap<NodeId, Skin> => UNPAINTED;

function read<TPose>(
  scene: RigNodeSource<TPose>,
  id: NodeId,
  descriptor: PoseDescriptor<TPose>,
  painted: ReadonlyMap<NodeId, Skin> = UNPAINTED,
): Reading {
  const node = scene.get(id);
  if (!node) throw new Error(`rigFromNode: the rig is node "${id}", which the scene lacks.`);
  const local = (node.data as RigNodeData | null | undefined)?.skeleton;
  if (!local) throw new Error(`rigFromNode: node "${id}" has no skeleton in its data.`);

  const skeleton = placeSkeleton(local, node.pose, descriptor);

  const out: Reading = { skeleton, bindings: {}, skins: {}, refs: [node.pose, node.data] };
  const walk = (parent: NodeId): void => {
    for (const child of scene.childrenOf(parent)) {
      const n = scene.get(child);
      if (!n) continue;
      const data = n.data as RigNodeData | null | undefined;
      const skin = painted.get(child) ?? data?.skin;
      out.refs.push(child, n.pose, n.data, skin);
      if (skin) out.skins[child] = skin;
      else if (data?.joint !== undefined) (out.bindings[data.joint] ??= []).push(child);
      walk(child);
    }
  };
  walk(id);
  return out;
}

const sameRefs = (a: Reading, b: Reading): boolean =>
  a === b || (a.refs.length === b.refs.length && a.refs.every((r, i) => r === b.refs[i]));

/**
 * Read a rig out of the scene: the skeleton in `id`'s `data.skeleton`, placed by that node's
 * pose, and under it every node whose data has a `skin` or names a `joint`.
 */
export function rigFromNode<TPose>(
  scene: RigNodeSource<TPose>,
  id: NodeId,
  descriptor: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): RigNodeParts {
  const { skeleton, bindings, skins } = read(scene, id, descriptor);
  return { skeleton, bindings, skins };
}

/** Options for `useRigNode`. */
export interface UseRigNodeOptions<TPose>
  extends Pick<BindRigOptions<TPose>, 'apply' | 'descriptor' | 'restPath'> {
  scene: RigScene<TPose> & RigNodeSource<TPose> & {
    subscribe(listener: () => void): () => void;
    getVersion(): number;
  };
  /** The node whose data holds the skeleton. */
  node: NodeId;
  /** Weights bound in place of a node's `data.skin` while they are held. Give it the
   *  `RigEditState` `@weasel-js/rig`'s weight tool has, and a stroke bends the path as it is painted. */
  painting?: PaintedSkins;
}

/**
 * A {@link Rig} read from a node, as {@link rigFromNode} reads it. It is bound again when the
 * rig node or a node under it changes its pose or data, or when nodes under it come or go; an
 * edit elsewhere in the scene leaves it alone. A rig bound again keeps its `target`, with the
 * animations running on it, its committed pose, and its placement, unless the skeleton's
 * joints were added, removed, renamed, or reordered. Then it has a new `target`, which takes
 * over the placement and the pose of every joint the skeleton still names. Animations go on
 * running on the target they were started on and show through the new one, so a joint that
 * was renamed stops moving.
 */
export function useRigNode<TPose>(options: UseRigNodeOptions<TPose>): Rig {
  const { scene, node, apply, descriptor, restPath, painting } = options;
  const version = useSyncExternalStore(scene.subscribe, scene.getVersion);
  const painted = useSyncExternalStore(painting?.listen ?? noWord, painting?.painted ?? unpainted);
  const next = useMemo(
    () => read(scene, node, descriptor ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>), painted),
    // `version` is what says the scene may answer differently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, node, descriptor, version, painted],
  );
  // Each read makes new objects; the rig must outlive a read that found nothing changed.
  const [held, setHeld] = useState(next);
  const parts = sameRefs(held, next) ? held : next;
  if (parts !== held) setHeld(next);
  const joints = JSON.stringify(parts.skeleton.joints.map((joint) => joint.name));
  // A pose target's axes are its joints' names in order, so the seat holds while those do,
  // and the next one takes over from it.
  const [seated, setSeated] = useState(() => ({ joints, seat: createRigSeat(parts.skeleton) }));
  let { seat } = seated;
  if (seated.joints !== joints) {
    seat = createRigSeat(parts.skeleton, seated.seat);
    setSeated({ joints, seat });
  }
  return useSeatedRig({
    scene, skeleton: parts.skeleton, bindings: parts.bindings, skins: parts.skins, apply, descriptor, restPath,
  }, seat);
}
