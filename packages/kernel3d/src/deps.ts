/**
 * The kit's deps, implemented against a 3D world.
 *
 * Every one of these takes its camera from a thunk rather than an argument.
 * That is the kernel's central claim in code: the dispatcher keeps handing
 * actions two numbers, and what makes them mean something in 3D is the camera
 * each dep already closes over. `InvocationCtx` needs no widening, and none of
 * these needs a ray passed in.
 *
 * Where a kit contract cannot be honored, the implementation throws rather than
 * guessing. A guess would report a fit the kernel does not have.
 */

import type {
  AreaSelectDep,
  InsertDep,
  InsertExtras,
  NodeAtPointDep,
  NodeId,
  PoseDescriptor,
  Scene,
  SceneNode,
  SnapDep,
} from '@weasel-js/core';
import {
  add,
  dot,
  intersectRayAabb,
  intersectRayPlane,
  len,
  normalize,
  quatIdentity,
  scale as scaleBy,
  sub,
  type Aabb,
  type Ray,
  type Vec3,
} from '@weasel-js/geom/3d';
import { cameraEye, cameraViewProjection, type Camera3d } from './camera';
import { aabbOfPose, type Pose3 } from './pose3';
import {
  projectAabbToScreen,
  rayThroughScreenPoint,
  type ScreenBox,
} from './screen';

export interface Viewport3d {
  camera: Camera3d;
  width: number;
  height: number;
  /**
   * Where the pane sits in client coordinates. A 3D host works in one space
   * from the event to the ray — it passes the dispatcher an identity
   * `clientToWorld` — so the deps subtract this rather than the dispatcher.
   */
  originX?: number;
  originY?: number;
}

export type ViewportSource = () => Viewport3d;

/** A 3D scene is core's scene with a `Pose3`. Nothing wraps it. */
export type Scene3d<TData, TLayer extends string> = Scene<TData, TLayer, Pose3>;
export type Node3d<TData, TLayer extends string> = SceneNode<TData, TLayer, Pose3>;

/**
 * The world box a node occupies. The kernel cannot answer this, and the reason
 * is sharper than "it does not know the mesh": a sphere's box is the same under
 * every rotation, and no transform of a local box reproduces that — rotate a
 * cube and it widens. Asking for the world box directly is what lets a
 * primitive answer for its own symmetry.
 *
 * Omitted, a node is a unit cube carried by its pose.
 */
export type NodeBounds<TData, TLayer extends string> = (
  node: Node3d<TData, TLayer>,
) => Aabb;

export interface World3d<TData, TLayer extends string> {
  scene: Scene3d<TData, TLayer>;
  viewport: ViewportSource;
  bounds?: NodeBounds<TData, TLayer>;
  /** The axis gestures resolve against. Default `+y`. */
  up?: Vec3;
}

const DEFAULT_UP: Vec3 = { x: 0, y: 1, z: 0 };

function boundsOfNode<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  node: Node3d<TData, TLayer>,
): Aabb {
  return world.bounds ? world.bounds(node) : aabbOfPose(node.pose);
}

/** The pane, in the coordinate space the host's points arrive in. The origin
 *  defaults to the client origin — a host that fills the window passes none. */
function rectOf(viewport: Viewport3d): ScreenBox {
  return {
    x: viewport.originX ?? 0,
    y: viewport.originY ?? 0,
    width: viewport.width,
    height: viewport.height,
  };
}

function viewProjectionOf(viewport: Viewport3d) {
  return cameraViewProjection(viewport.camera, viewport.width / Math.max(1, viewport.height));
}

function rayAt(viewport: Viewport3d, point: { x: number; y: number }): Ray | null {
  return rayThroughScreenPoint(
    point,
    rectOf(viewport),
    viewProjectionOf(viewport),
    cameraEye(viewport.camera),
  );
}

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

/** The world box containing `points`. */
function aabbOfPoints(points: readonly Vec3[]): Aabb {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    for (const axis of ['x', 'y', 'z'] as const) {
      if (p[axis] < min[axis]) min[axis] = p[axis];
      if (p[axis] > max[axis]) max[axis] = p[axis];
    }
  }
  return { min, max };
}

function pointOnRay(ray: Ray, t: number): Vec3 {
  return {
    x: ray.origin.x + ray.direction.x * t,
    y: ray.origin.y + ray.direction.y * t,
    z: ray.origin.z + ray.direction.z * t,
  };
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

/** No grid in 3D yet; the identity keeps `insertAction` happy without lying. */
export function createSnap(): SnapDep {
  return { point: (p) => p };
}

/** The ground-plane rectangle a drag swept out, in world units. */
export interface Footprint {
  /** Centre of the swept rectangle, on the ground plane. */
  center: Vec3;
  /** Extent along the two axes the up axis is not. */
  width: number;
  depth: number;
}

/**
 * A drag rectangle becomes a footprint on the ground plane: its four corners
 * are cast onto the plane and the hit points give the extent. What node that
 * implies is the consumer's answer — the kernel does not know what it is
 * inserting.
 *
 * The kit's `InsertDep.commit` hands over a screen-space AABB and nothing else,
 * which turns out to be enough: the depth the 2D contract cannot express comes
 * from the plane, not from the caller.
 */
export function createInsert(opts: {
  viewport: ViewportSource;
  up?: Vec3;
  /** Smallest footprint a click-sized drag produces. Default 0.25. */
  minExtent?: number;
  mint(footprint: Footprint, extras: InsertExtras): NodeId | null;
}): InsertDep {
  const up = opts.up ?? DEFAULT_UP;
  const minExtent = opts.minExtent ?? 0.25;
  // The two axes the up axis is not, so a footprint reads the same whichever
  // way up the world is.
  const axes: readonly ['x' | 'y' | 'z', 'x' | 'y' | 'z'] =
    up.y !== 0 ? ['x', 'z'] : up.x !== 0 ? ['y', 'z'] : ['x', 'y'];

  return {
    commit(bounds, extras) {
      const vp = opts.viewport();
      const corners = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x, y: bounds.y + bounds.height },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      ];

      const hits: Vec3[] = [];
      for (const corner of corners) {
        const ray = rayAt(vp, corner);
        if (!ray) continue;
        const t = intersectRayPlane(ray, up, 0);
        if (t !== null) hits.push(pointOnRay(ray, t));
      }
      if (hits.length === 0) return null;

      const [u, v] = axes;
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      for (const h of hits) {
        minU = Math.min(minU, h[u]); maxU = Math.max(maxU, h[u]);
        minV = Math.min(minV, h[v]); maxV = Math.max(maxV, h[v]);
      }

      const center = { x: 0, y: 0, z: 0 };
      center[u] = (minU + maxU) / 2;
      center[v] = (minV + maxV) / 2;
      return opts.mint(
        {
          center,
          width: Math.max(minExtent, maxU - minU),
          depth: Math.max(minExtent, maxV - minV),
        },
        extras,
      );
    },
  };
}

/**
 * `PoseDescriptor` over a 3D pose, with `Bounds` read as the screen box the
 * node covers. Chrome and marquee math work unchanged; the two methods that
 * run the other way cannot.
 *
 * `forNode` is what lets a sphere bound itself as a sphere: every node is a
 * `Pose3`, so the shape lives on `node.data` and nothing but the node can say
 * which one this is. Unspecialized — the kit calling with only a pose in hand —
 * it answers with the default local box, which is the looser of the two.
 *
 * The two methods that run the other way — `remapBounds` and `fromBounds` —
 * take a screen rectangle, which names a pose only once something supplies a
 * depth. Both resolve it against the plane through the pose they were handed,
 * facing the camera, so nothing they produce changes depth. See
 * {@link viewPlaneAt}.
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

      /**
       * Screen-space deltas resolve against the plane the node already sits on,
       * so the two numbers the kit passes are enough: the camera that turns
       * them into a world position is the one this dep closed over.
       */
      translate(pose, dx, dy) {
        const vp = castableViewport();
        if (!vp) return pose;
        const box = boundsIn(vp, pose);
        if (!box) return pose;
        const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const to = { x: from.x + dx, y: from.y + dy };
        const offset = pose.position[upAxis];

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

      intersectsRect(pose, rect) {
        const box = boundsOf(pose);
        return box ? overlaps(box, rect) : false;
      },

      supportsRotation() {
        return false;
      },
    };

    return descriptor;
  }

  return build((pose) => aabbOfPose(pose));
}
