import type { PoseDescriptor } from '../../core/geometry/poseDescriptor';
import type { NodeId, PoseOverride, PoseOverrides } from '../../core/scene/types';
import { AUTO_POSE_DESCRIPTOR } from '../../interactions/actions/resize/autoPoseDescriptor';
import { mat3, type GlMat3 } from '../../renderer/math/mat3';
import { resolveSkeleton } from './resolveSkeleton';
import type { Pose, Skeleton } from './types';

/** The part of a scene a rig writes to. */
export interface RigScene<TPose> {
  get(id: NodeId): { pose: TPose } | undefined;
  readonly overrides: PoseOverrides<TPose>;
  setPose(id: NodeId, pose: TPose): void;
  batch<T>(label: string, fn: () => T): T;
}

export interface RigApplyContext<TPose> {
  joint: string;
  node: NodeId;
  /** The node's document pose when the rig was bound — where it sits at the
   *  bind pose. */
  rest: TPose;
  /** The joint's world transform at the bind pose. */
  restWorld: GlMat3;
  /** `world * inverse(restWorld)`: the motion since the bind pose, in world
   *  space. Carrying `rest` by it is what welding the node to the joint means. */
  fromRest: GlMat3;
}

/** Turns a joint's world transform into a pose for one bound node. The only
 *  part of a rig that knows the scene's pose shape. */
export type RigApply<TPose> = (world: GlMat3, ctx: RigApplyContext<TPose>) => TPose;

export interface BindRigOptions<TPose> {
  scene: RigScene<TPose>;
  skeleton: Skeleton;
  /** Joint name → the node or nodes that ride it. Each node keeps the offset
   *  from its joint that it has at the bind pose. */
  bindings: Readonly<Record<string, NodeId | readonly NodeId[]>>;
  /** Default: {@link rigidRigApply} over `descriptor`. */
  apply?: RigApply<TPose>;
  /** The descriptor the default `apply` reads and writes poses through.
   *  Default `AUTO_POSE_DESCRIPTOR`. */
  descriptor?: PoseDescriptor<TPose>;
}

export interface Rig {
  readonly skeleton: Skeleton;
  /**
   * Resolve `pose` and move every bound node to it, through the scene's pose
   * overrides — no history entry, no document write, no version bump — then
   * commit them. The per-frame write. `root` places the rig in the world, and
   * may mirror it.
   */
  pose(pose: Pose, root?: GlMat3): void;
  /** The joint world transforms the last `pose` resolved, root applied. */
  world(): ReadonlyMap<string, GlMat3>;
  /** Write the current frame into the bound nodes' document poses as one
   *  undo entry, and drop the overrides. Later frames stay relative to the
   *  bind-time rest, so baking does not compound. */
  bake(label?: string): void;
  /** Drop the overrides; the nodes show their document poses again until the
   *  next `pose`. */
  release(): void;
}

/**
 * Carries a node rigidly with its joint: the rest pose's center moves by
 * `fromRest`, and its rotation turns with the rest pose's x-axis. Scale in the
 * joint chain moves positions but not sizes — the pose model holds no shear,
 * and a sized pose under anisotropic scale would need one. Write an `apply`
 * that reads `world` to size nodes from joint scale.
 */
export function rigidRigApply<TPose>(descriptor: PoseDescriptor<TPose>): RigApply<TPose> {
  return (_world, { rest, fromRest }) => {
    const b = descriptor.getBounds(rest);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const [nx, ny] = mat3.apply(fromRest, cx, cy);
    const moved = descriptor.translate
      ? descriptor.translate(rest, nx - cx, ny - cy)
      : descriptor.remapBounds(rest, b, { ...b, x: b.x + nx - cx, y: b.y + ny - cy });
    if (!descriptor.withRotation) return moved;
    const r0 = descriptor.getRotation?.(rest) ?? 0;
    const ux = Math.cos(r0);
    const uy = Math.sin(r0);
    return descriptor.withRotation(
      moved,
      Math.atan2(fromRest[1] * ux + fromRest[4] * uy, fromRest[0] * ux + fromRest[3] * uy),
    );
  };
}

interface Bound<TPose> {
  node: NodeId;
  joint: string;
  rest: TPose;
  restWorld: GlMat3;
  restInverse: GlMat3;
  entry: PoseOverride<TPose>;
}

/**
 * Bind a skeleton's joints to scene nodes. Nodes are written in world space
 * and the rig resolves its own hierarchy, so bound nodes are best left
 * unparented, or under containers whose pose does not compose into theirs;
 * the scene's tree stays free to order and group them for drawing.
 */
export function bindRig<TPose>(options: BindRigOptions<TPose>): Rig {
  const { scene, skeleton } = options;
  const apply = options.apply ?? rigidRigApply(options.descriptor ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>));
  const restWorlds = resolveSkeleton(skeleton, {});

  const bound: Bound<TPose>[] = [];
  for (const [joint, ids] of Object.entries(options.bindings)) {
    const restWorld = restWorlds.get(joint);
    if (!restWorld) throw new Error(`bindRig: the skeleton has no joint "${joint}".`);
    const restInverse = mat3.invert(restWorld);
    if (!restInverse) throw new Error(`bindRig: joint "${joint}" is singular at the bind pose.`);
    for (const node of typeof ids === 'string' ? [ids] : (ids as readonly NodeId[])) {
      const n = scene.get(node);
      if (!n) throw new Error(`bindRig: joint "${joint}" is bound to node "${node}", which the scene lacks.`);
      bound.push({ node, joint, rest: n.pose, restWorld, restInverse, entry: { pose: n.pose } });
    }
  }

  let world: ReadonlyMap<string, GlMat3> = restWorlds;
  let installed = false;

  const release = () => {
    if (!installed) return;
    installed = false;
    for (const b of bound) scene.overrides.clear(b.node);
  };

  return {
    skeleton,
    pose(pose, root) {
      const local = resolveSkeleton(skeleton, pose);
      if (root) for (const [name, m] of local) local.set(name, mat3.multiply(root, m));
      world = local;
      const fromRest = new Map<string, GlMat3>();
      for (const b of bound) {
        const w = local.get(b.joint)!;
        let delta = fromRest.get(b.joint);
        if (!delta) {
          delta = mat3.multiply(w, b.restInverse);
          fromRest.set(b.joint, delta);
        }
        b.entry.pose = apply(w, { joint: b.joint, node: b.node, rest: b.rest, restWorld: b.restWorld, fromRest: delta });
        if (!installed) scene.overrides.set(b.node, b.entry);
      }
      installed = true;
      scene.overrides.commit();
    },
    world: () => world,
    bake(label = 'Bake rig pose') {
      if (!installed) return;
      scene.batch(label, () => {
        for (const b of bound) if (b.entry.pose !== undefined) scene.setPose(b.node, b.entry.pose);
      });
      release();
    },
    release,
  };
}
