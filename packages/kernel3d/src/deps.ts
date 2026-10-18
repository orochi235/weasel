/**
 * The kit's deps, implemented against a 3D world.
 *
 * Every one of these takes its camera from a thunk rather than an argument:
 * the dispatcher keeps handing actions two numbers, and what makes them mean
 * something in 3D is the camera each dep already closes over.
 */

import type {
  AreaSelectDep,
  NodeAtPointDep,
  NodeId,
  PoseDescriptor,
  SnapDep,
  SnapOutcomeStore,
  SnapSource,
} from '@weasel-js/core';
import { DEFAULT_SNAP_PX, createSnapOutcomeStore, distinctSnapSources } from '@weasel-js/core';
import type { KitSettingsStore } from '@weasel-js/react';
import {
  aabbOfPoints,
  add,
  dot,
  intersectRayAabb,
  intersectRayPlane,
  len,
  normalize,
  pointOnRay,
  quatIdentity,
  scale as scaleBy,
  sub,
  type Aabb,
  type Vec3,
} from '@weasel-js/geom/3d';
import { cameraEye, type Camera3d } from './camera';
import { aabbOfPose, type Pose3 } from './pose3';
import { rayAt, rectOf, viewProjectionOf, type Viewport3d } from './project';
import { projectAabbToScreen, type ScreenBox } from './screen';
import { createSession3d } from './snap/session3d';

import { DEFAULT_UP, boundsOfNode, type Node3d, type World3d } from './world';

export type { Viewport3d, ViewportSource } from './project';
export type { NodeBounds, Node3d, Scene3d, World3d } from './world';

/**
 * The plane through `p` that faces the camera.
 *
 * This is the depth choice the kit's reverse contracts need: a screen
 * rectangle names a pose only once something says how far away it is, and the
 * answer is "as far as it already was". Nothing resolved on this plane changes
 * depth, and one screen pixel is the same world distance everywhere on it.
 */
function viewPlaneAt(camera: Camera3d, p: Vec3): { normal: Vec3; offset: number } {
  const normal = normalize(sub(camera.target, cameraEye(camera)));
  return { normal, offset: dot(normal, p) };
}

/** Where a screen point lands on `plane`, or `null` when it casts no ray. */
function onPlane(
  vp: Viewport3d,
  plane: { normal: Vec3; offset: number },
  point: { x: number; y: number },
): Vec3 | null {
  const ray = rayAt(vp, point);
  if (!ray) return null;
  const t = intersectRayPlane(ray, plane.normal, plane.offset);
  return t === null ? null : pointOnRay(ray, t);
}

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

/** The screen box a node covers, or null when it projects to nothing visible. */
export function screenBoxOf<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  id: NodeId,
  viewport: Viewport3d,
): ScreenBox | null {
  const node = world.scene.get(id) as Node3d<TData, TLayer> | undefined;
  if (!node) return null;
  return projectAabbToScreen(
    boundsOfNode(world, node),
    viewProjectionOf(viewport),
    rectOf(viewport),
  );
}

/**
 * Nearest node along the ray the screen point names.
 *
 * The kit calls this with what it believes is a world point; a 3D host feeds
 * the dispatcher an identity `clientToWorld`, so it is the pane-relative screen
 * point, which is exactly what a ray needs.
 */
export function createNodeAtPoint<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
): NodeAtPointDep {
  return (point, exclude) => {
    const excluded = exclude ? new Set(exclude) : null;
    const vp = world.viewport();
    const ray = rayAt(vp, point);
    if (!ray) return null;
    let best: NodeId | null = null;
    let bestT = Infinity;
    for (const node of world.scene.renderOrderNodes() as readonly Node3d<TData, TLayer>[]) {
      if (excluded?.has(node.id)) continue;
      const { min, max } = boundsOfNode(world, node);
      const t = intersectRayAabb(ray, min, max);
      if (t !== null && t < bestT) {
        bestT = t;
        best = node.id;
      }
    }
    return best;
  };
}

/** Marquee: the nodes whose projected box the screen rectangle touches. */
export function createAreaSelect<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  selection: { get(): readonly NodeId[]; set(ids: NodeId[]): void },
): AreaSelectDep {
  return {
    hitTestArea(bounds) {
      const vp = world.viewport();
      const hits: NodeId[] = [];
      for (const node of world.scene.renderOrderNodes()) {
        const box = screenBoxOf(world, node.id, vp);
        if (box && overlaps(box, bounds)) hits.push(node.id);
      }
      return hits;
    },
    getSelection: () => [...selection.get()],
    setSelection: (ids) => selection.set([...ids]),
  };
}

/** Options for `createSnap`. */
export interface Snap3dOptions {
  /** What a gesture snaps to, in order: earlier wins a full tie, and a later
   *  source with an id replaces an earlier one. Default none, which leaves
   *  only the gesture's own constraint. */
  sources?: readonly SnapSource<Vec3>[];
  /** The reach of a source that sets none, in screen px. Overrides the kit
   *  setting `targets.snapPx`. */
  reachPx?: number;
  /** Where `targets.snapPx` is read, when each gesture begins. Absent, and
   *  with no `reachPx`, reach is `DEFAULT_SNAP_PX`. */
  kitSettings?: KitSettingsStore;
  /** Where the marks of the snap in flight are written, for a host to draw
   *  with `projectSnapMarks`. */
  store?: SnapOutcomeStore<Vec3>;
}

/**
 * The `snap` dep over a 3D world. A move snaps its subject's world box on the
 * plane it already moves on; an insert snaps the pointer on the ground. Both
 * answer in screen points, which `translate` and `createInsert` cast back
 * onto the same plane, landing exactly where the snap put them.
 */
export function createSnap<TData, TLayer extends string>(
  world: World3d<TData, TLayer>, opts: Snap3dOptions = {},
): SnapDep {
  const store = opts.store ?? createSnapOutcomeStore<Vec3>();
  const sources = distinctSnapSources(opts.sources ?? []);
  return {
    begin: (req) => createSession3d({
      req, world, sources, store,
      reachPx: opts.reachPx ?? opts.kitSettings?.get('targets.snapPx') ?? DEFAULT_SNAP_PX,
    }),
  };
}

/**
 * `PoseDescriptor` over a 3D pose, with `Bounds` read as the screen box the
 * node covers.
 *
 * `forNode` is what lets a sphere bound itself as a sphere: the shape lives
 * on `node.data`. Unspecialized — the kit calling with only a pose in hand —
 * it answers with the default local box, which is the looser of the two.
 *
 * `remapBounds` and `fromBounds` take a screen rectangle, which names a pose
 * only once something supplies a depth. Both resolve it against the plane
 * through the pose they were handed, facing the camera, so nothing they
 * produce changes depth.
 */
export function createPoseDescriptor<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
): PoseDescriptor<Pose3, Node3d<TData, TLayer>> {
  const up = world.up ?? DEFAULT_UP;
  const upAxis = up.y !== 0 ? 'y' : up.x !== 0 ? 'x' : 'z';
  const specialized = new WeakMap<object, PoseDescriptor<Pose3, Node3d<TData, TLayer>>>();

  // A drag whose camera stops casting rays mid-gesture keeps moving through the
  // last one that did, rather than snapping the node back.
  let lastCastable: Viewport3d | null = null;
  function castableViewport(): Viewport3d | null {
    const vp = world.viewport();
    const rect = rectOf(vp);
    if (rayAt(vp, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })) lastCastable = vp;
    return lastCastable;
  }

  function build(worldBox: (pose: Pose3) => Aabb): PoseDescriptor<Pose3, Node3d<TData, TLayer>> {
    const boundsIn = (vp: Viewport3d, pose: Pose3) =>
      projectAabbToScreen(worldBox(pose), viewProjectionOf(vp), rectOf(vp));
    const boundsOf = (pose: Pose3) => boundsIn(world.viewport(), pose);

    const descriptor: PoseDescriptor<Pose3, Node3d<TData, TLayer>> = {
      forNode(node) {
        let d = specialized.get(node);
        if (!d) {
          // The pose arriving here is often an in-flight override rather than
          // `node.pose`, so the consumer is asked about that pose on this node
          // rather than about the node as committed.
          d = build((pose) => boundsOfNode(world, { ...node, pose }));
          specialized.set(node, d);
        }
        return d;
      },

      getBounds(pose) {
        return boundsOf(pose) ?? { x: 0, y: 0, width: 0, height: 0 };
      },

      /**
       * The src→dst screen map, applied at the pose's own depth: the node's
       * screen anchor moves the way the rectangle does, and both ends of that
       * move are read back off the plane through its position, so the world
       * delta is exact rather than a scaled screen one.
       *
       * The scale is uniform. The rectangle names two extents and a pose has
       * three, so there is no reading in which a screen box resizes a solid
       * per-axis; the geometric mean is the one factor that agrees with both
       * of the extents it does name.
       */
      remapBounds(pose, src, dst) {
        const vp = castableViewport();
        if (!vp) return pose;
        const box = boundsIn(vp, pose);
        if (!box) return pose;

        const kx = src.width === 0 ? 1 : dst.width / src.width;
        const ky = src.height === 0 ? 1 : dst.height / src.height;
        const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const to = {
          x: dst.x + (from.x - src.x) * kx,
          y: dst.y + (from.y - src.y) * ky,
        };

        const plane = viewPlaneAt(vp.camera, pose.position);
        const before = onPlane(vp, plane, from);
        const after = onPlane(vp, plane, to);
        if (!before || !after) return pose;

        const k = Math.sqrt(Math.abs(kx * ky));
        return {
          ...pose,
          position: add(pose.position, sub(after, before)),
          scale: scaleBy(pose.scale, k),
        };
      },

      /**
       * The world box the rectangle covers at the template's depth, as a pose.
       *
       * The rectangle is flat and a box is not, so the third extent — the one
       * no screen rectangle names — is the mean of the two it does. The result
       * is world-axis-aligned and unrotated: the pose carries none of the
       * template's shape, which is the contract, and it takes only its depth.
       *
       * Extents are written as `scale`, so this reads a pose as carrying a
       * unit primitive — the same assumption `aabbOfPose` makes by default.
       */
      fromBounds(bounds, template) {
        const vp = castableViewport();
        if (!vp) return template;
        const plane = viewPlaneAt(vp.camera, template.position);

        const corners: Vec3[] = [];
        for (const [x, y] of [
          [bounds.x, bounds.y],
          [bounds.x + bounds.width, bounds.y],
          [bounds.x, bounds.y + bounds.height],
          [bounds.x + bounds.width, bounds.y + bounds.height],
        ]) {
          const corner = onPlane(vp, plane, { x, y });
          if (!corner) return template;
          corners.push(corner);
        }

        const width = len(sub(corners[1]!, corners[0]!));
        const height = len(sub(corners[2]!, corners[0]!));
        const half = Math.sqrt(width * height) / 2;
        const box = aabbOfPoints(
          corners.flatMap((c) => [
            add(c, scaleBy(plane.normal, half)),
            sub(c, scaleBy(plane.normal, half)),
          ]),
        );
        return {
          position: scaleBy(add(box.min, box.max), 0.5),
          rotation: quatIdentity(),
          scale: sub(box.max, box.min),
        };
      },

      /** Screen-space deltas resolve against the plane the node already sits on. */
      translate(pose, dx, dy) {
        const vp = castableViewport();
        if (!vp) return pose;
        const box = boundsIn(vp, pose);
        if (!box) return pose;
        const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const to = { x: from.x + dx, y: from.y + dy };
        const offset = dot(up, pose.position);

        const ray = rayAt(vp, to);
        if (!ray) return pose;
        const t = intersectRayPlane(ray, up, offset);
        if (t === null) return pose;

        const anchorRay = rayAt(vp, from);
        if (!anchorRay) return pose;
        const anchorT = intersectRayPlane(anchorRay, up, offset);
        if (anchorT === null) return pose;

        const delta = sub(pointOnRay(ray, t), pointOnRay(anchorRay, anchorT));
        const position = {
          x: pose.position.x + delta.x,
          y: pose.position.y + delta.y,
          z: pose.position.z + delta.z,
        };
        position[upAxis] = pose.position[upAxis];
        return { ...pose, position };
      },

      supportsRotation() {
        return false;
      },
    };

    return descriptor;
  }

  return build((pose) => aabbOfPose(pose));
}
