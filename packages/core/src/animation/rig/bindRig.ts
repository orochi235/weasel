import type { PoseDescriptor } from '../../core/geometry/poseDescriptor';
import type { NodeId, PoseOverride } from '../../core/scene/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { Target } from '@weasel-js/animator';
import { resolveSkeleton } from '@weasel-js/animator';
import type { Pose, Skeleton } from '@weasel-js/animator';
import type { Skin } from '@weasel-js/animator';
import { createRigSeat, type RigBinding, type RigSeat } from './rigSeat';
import { bindSkins, dataRestPath, type RestPath, type SkinScene } from './skinBinding';

/** The part of a scene a rig writes to. */
export interface RigScene<TPose> extends SkinScene<TPose> {
  batch<T>(label: string, fn: () => T): T;
}

/** What a `RigApply` knows about the node it is posing. */
export interface RigApplyContext<TPose> {
  /** The joint the node rides. */
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

/** Options for `bindRig`. */
export interface BindRigOptions<TPose> {
  scene: RigScene<TPose>;
  skeleton: Skeleton;
  /** Joint name → the node or nodes that ride it. Each node keeps the offset
   *  from its joint that it has at the bind pose. */
  bindings?: Readonly<Record<string, NodeId | readonly NodeId[]>>;
  /** Node id → the weights its path bends by. Where a bound node moves whole with one joint,
   *  a skinned node's points each follow their own joints, and the rig shows the bent path
   *  through the node's pose override, posed at the path's bounds. */
  skins?: Readonly<Record<NodeId, Skin>>;
  /** Where a skinned node's path is drawn when the rig is bound. Default
   *  {@link dataRestPath}: the node's `data.path`, through its pose. */
  restPath?: RestPath<TPose>;
  /** Default: {@link rigidRigApply} over `descriptor`. */
  apply?: RigApply<TPose>;
  /** The descriptor the default `apply` reads and writes poses through.
   *  Default `AUTO_POSE_DESCRIPTOR`. */
  descriptor?: PoseDescriptor<TPose>;
}

/** A skeleton bound to scene nodes, as `bindRig` returns it. */
export interface Rig {
  readonly skeleton: Skeleton;
  /**
   * The rig's pose as a value an animator moves. Its committed value starts as `{}`, the bind
   * pose, and each frame the rig is posed with what the target shows. A clip is a
   * `SampledTrack<Pose>` given this as its `target`: clips on one rig crossfade by their
   * `weight`s, weights short of 1 leave the rest to the committed pose, and a `spring` or
   * `tween` from a pose away from the committed one adds on top. `animator.hold` shows a pose made elsewhere the same way, an
   * IK solve included.
   */
  readonly target: Target<Pose>;
  /**
   * Commit `pose` and move every bound node to what the target now shows, which is `pose`
   * unless something is animating the target; a hold on it weighs the new pose in when it is
   * next read, at the animator's next frame or the hold's `touch()`. Writes go through the scene's pose overrides —
   * no history entry, no document write, no version bump — and are committed. `root`, where
   * given, replaces the placement, as {@link Rig.place}.
   */
  pose(pose: Pose, root?: GlMat3): void;
  /** Place the rig in the world by `root`, which may mirror it, and pose it there. It stays
   *  until placed again; with no `root`, the rig goes back to where its skeleton puts it. */
  place(root?: GlMat3): void;
  /** The joint world transforms as the rig was last posed, root applied. */
  world(): ReadonlyMap<string, GlMat3>;
  /** Write the current frame into the bound nodes' document poses as one
   *  undo entry, and drop the overrides. A skinned node's bent path goes into
   *  its `data.path`. Later frames stay relative to the bind-time rest, so
   *  baking does not compound. */
  bake(label?: string): void;
  /** Drop the overrides; the nodes show their document poses again until the
   *  rig is next posed. */
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
  entry: PoseOverride<TPose>;
}

/**
 * Bind a skeleton's joints to scene nodes. Nodes are written in world space
 * and the rig resolves its own hierarchy, so bound nodes are best left
 * unparented, or under containers whose pose does not compose into theirs;
 * the scene's tree stays free to order and group them for drawing.
 */
export function bindRig<TPose>(options: BindRigOptions<TPose>): Rig {
  const seat = createRigSeat(options.skeleton);
  const { rig, binding } = bindRigOn(options, seat);
  seat.binding = binding;
  return rig;
}

/** {@link bindRig} on a seat the caller keeps. The rig shows the seat's target once its
 *  `binding` is the seat's. */
export function bindRigOn<TPose>(
  options: BindRigOptions<TPose>,
  seat: RigSeat,
): { rig: Rig; binding: RigBinding } {
  const { scene, skeleton } = options;
  const descriptor = options.descriptor ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const apply = options.apply ?? rigidRigApply(descriptor);
  const restWorlds = resolveSkeleton(skeleton, {});
  const restInverses = new Map<string, GlMat3>();
  const restInverseOf = (joint: string): GlMat3 => {
    let inverse = restInverses.get(joint);
    if (inverse) return inverse;
    const restWorld = restWorlds.get(joint);
    if (!restWorld) throw new Error(`bindRig: the skeleton has no joint "${joint}".`);
    inverse = mat3.invert(restWorld) ?? undefined;
    if (!inverse) throw new Error(`bindRig: joint "${joint}" is singular at the bind pose.`);
    restInverses.set(joint, inverse);
    return inverse;
  };

  const skins = bindSkins(scene, options.skins ?? {}, options.restPath ?? dataRestPath, descriptor);
  skins.joints.forEach(restInverseOf);

  const bound: Bound<TPose>[] = [];
  for (const [joint, ids] of Object.entries(options.bindings ?? {})) {
    restInverseOf(joint);
    const restWorld = restWorlds.get(joint)!;
    for (const node of typeof ids === 'string' ? [ids] : (ids as readonly NodeId[])) {
      if (options.skins && node in options.skins) {
        throw new Error(`bindRig: node "${node}" is both bound to joint "${joint}" and skinned.`);
      }
      const n = scene.get(node);
      if (!n) throw new Error(`bindRig: joint "${joint}" is bound to node "${node}", which the scene lacks.`);
      bound.push({ node, joint, rest: n.pose, restWorld, entry: { pose: n.pose } });
    }
  }

  let world: ReadonlyMap<string, GlMat3> = restWorlds;
  let installed = false;

  const drop = () => {
    if (!installed) return;
    installed = false;
    for (const b of bound) scene.overrides.clear(b.node, b.entry);
    skins.release();
  };
  const release = () => {
    seat.shown = false;
    drop();
  };

  const show = (pose: Pose): void => {
    const local = resolveSkeleton(skeleton, pose);
    const { root } = seat;
    if (root) for (const [name, m] of local) local.set(name, mat3.multiply(root, m));
    world = local;
    const fromRest = new Map<string, GlMat3>();
    const motionOf = (joint: string): GlMat3 => {
      let delta = fromRest.get(joint);
      if (!delta) {
        delta = mat3.multiply(local.get(joint)!, restInverseOf(joint));
        fromRest.set(joint, delta);
      }
      return delta;
    };
    for (const b of bound) {
      const w = local.get(b.joint)!;
      b.entry.pose = apply(w, { joint: b.joint, node: b.node, rest: b.rest, restWorld: b.restWorld, fromRest: motionOf(b.joint) });
      if (!installed) scene.overrides.set(b.node, b.entry);
    }
    skins.joints.forEach(motionOf);
    skins.show(fromRest);
    installed = true;
    seat.shown = true;
    scene.overrides.commit();
  };

  const { target } = seat;
  const rig: Rig = {
    skeleton,
    target,
    pose(pose, at) {
      seat.committed = pose;
      if (at) seat.root = at;
      show(target.read());
    },
    place(at) {
      seat.root = at;
      show(target.read());
    },
    world: () => world,
    bake(label = 'Bake rig pose') {
      if (!installed) return;
      scene.batch(label, () => {
        for (const b of bound) if (b.entry.pose !== undefined) scene.setPose(b.node, b.entry.pose);
        skins.write();
      });
      release();
    },
    release,
  };
  return { rig, binding: { show, drop } };
}
