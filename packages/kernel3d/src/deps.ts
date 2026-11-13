/**
 * The kit's deps, implemented against a 3D world.
 *
 * Every one of these takes its camera from a thunk rather than an argument,
 * `viewportOf(world, viewId)` for the view it was built for:
 * the dispatcher keeps handing actions two numbers, and what makes them mean
 * something in 3D is the camera each dep already closes over.
 */

import type { AreaSelectDep, HitTestView, NodeAtPointDep, PoseDescriptor, SnapDep, SnapOutcomeStore, SnapSource } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/routing';
import { DEFAULT_SNAP_PX, createSnapOutcomeStore, assertSnapSourceIds, createEnteredGroupScope, pressTarget, type EnteredGroupApi } from '@weasel-js/core/engine';
import { isDev, type KitSettingsStore } from '@weasel-js/react';
import {
  aabbOfPoints,
  add,
  dot,
  len,
  quatIdentity,
  scale as scaleBy,
  sub,
  type Aabb,
  type Vec3,
} from '@weasel-js/geom/3d';
import { cameraBasis } from './camera';
import { aabbOfPose, type Pose3 } from './pose3';
import { groundAxes, type Axis } from './ground';
import { castOntoPlane, rayAt, rectOf, viewProjectionOf, type Viewport3d } from './project';
import { worldPickIndex } from './pickIndex';
import { projectAabbToScreen } from './screen';
import { createSession3d } from './snap/session3d';

import { DEFAULT_UP, measuredBoxAt, viewportOf, type Node3d, type World3d } from './world';

export type { Viewport3d, ViewportSource } from './project';
export type { NodeBounds, Node3d, Scene3d, World3d } from './world';
export { worldPoseOf } from './world';

/**
 * The plane through `p` that faces the camera.
 *
 * This is the depth choice the kit's reverse contracts need: a screen
 * rectangle names a pose only once something says how far away it is, and the
 * answer is "as far as it already was". Nothing resolved on this plane changes
 * depth, and one screen pixel is the same world distance everywhere on it.
 */
function viewPlaneAt(vp: Viewport3d, p: Vec3): { normal: Vec3; offset: number } {
  const normal = cameraBasis(vp.camera, vp.up).forward;
  return { normal, offset: dot(normal, p) };
}

/** Where a screen point lands on `plane`, or `null` when it casts no ray. */
function onPlane(
  vp: Viewport3d,
  plane: { normal: Vec3; offset: number },
  point: { x: number; y: number },
): Vec3 | null {
  return castOntoPlane(vp, point, plane.normal, plane.offset);
}

/** `pose` moved by `delta`, kept at its own height along `upAxis`. */
function movedOnLevel(pose: Pose3, delta: Vec3, upAxis: Axis): Pose3 {
  const position = { ...add(pose.position, delta), [upAxis]: pose.position[upAxis] };
  return { ...pose, position };
}

export { screenBoxOf } from './pickIndex';

/** Where a solid wholly behind the camera is: on no part of the screen, a box that is not finite, which core's
 *  region selects, pick index and unions already pass over, and its chrome does not draw. */
const OFF_SCREEN = Object.freeze({ x: NaN, y: NaN, width: NaN, height: NaN });

/**
 * The viewport a drag casts through. One whose camera stops casting rays mid-gesture keeps moving through the last
 * that did, rather than snapping the node back. Mid-gesture means a preview is in flight; a call with none, as a
 * gesture's first frame and a nudge are, starts afresh, so no gesture moves through an earlier one's camera.
 */
function castableViewportOf<TData, TLayer extends string>(
  world: World3d<TData, TLayer>, viewId: string | null | undefined,
): () => Viewport3d | null {
  let lastCastable: Viewport3d | null = null;
  return () => {
    const vp = viewportOf(world, viewId);
    const rect = rectOf(vp);
    if (rayAt(vp, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })) lastCastable = vp;
    else if (world.scene.overrides.ids().length === 0) lastCastable = null;
    return lastCastable;
  };
}

/**
 * Nearest node the camera draws along the ray the screen point names.
 *
 * The kit calls this with what it believes is a world point; a 3D host feeds
 * the dispatcher an identity `clientToWorld`, so it is the pane-relative screen
 * point, which is exactly what a ray needs. *
 * `viewId` names the view whose camera casts the ray; a surface with several
 * 3D views gives each `<CanvasView deps>` its own. The same goes for every
 * factory here that takes one.
 */
export function createNodeAtPoint<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  viewId?: string | null,
): NodeAtPointDep {
  return (point, exclude) => pickOnRay(world, viewId, point, exclude);
}

function pickOnRay<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  viewId: string | null | undefined,
  point: { x: number; y: number },
  exclude?: Iterable<NodeId>,
  layerIsPainted?: (layer: string) => boolean,
): NodeId | null {
  const ray = rayAt(viewportOf(world, viewId), point);
  if (!ray) return null;
  // The ray spans near to far plane at t 0..1.
  return worldPickIndex(world).nearestOnRay(ray, exclude ? new Set(exclude) : null, 1, layerIsPainted);
}

/**
 * `<SceneCanvas geometry={{ pickEvery }}>` over a 3D world: the node along the
 * ray the point names, cast from the camera of the view the pick is asked for,
 * passing over the layers that view does not paint.
 */
export function createPickEvery<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
): (point: { x: number; y: number }, view?: HitTestView) => NodeId | null {
  return (point, view) => pickOnRay(world, view?.viewId, point, undefined, layerGateOf(view));
}

/** The asking view's layer gate, called as a method so it keeps its receiver. */
function layerGateOf(view: HitTestView | undefined): ((layer: string) => boolean) | undefined {
  return view?.layerIsPainted ? (layer) => view.layerIsPainted!(layer) : undefined;
}

/** Options for `createAreaSelect`. */
export interface AreaSelect3dOptions {
  /** The entered group, as the canvas's `enteredGroup` dep has it. Given, a marquee reaches only what a press
   *  can and selects what a press on each hit selects: the outermost container above it that is not entered. */
  entered?: EnteredGroupApi;
}

/** Marquee: the nodes whose projected box the screen rectangle touches, in render
 *  order, less those on a layer the view the marquee was drawn in does not paint. */
export function createAreaSelect<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  selection: { get(): readonly NodeId[]; set(ids: NodeId[]): void },
  viewId?: string | null,
  opts: AreaSelect3dOptions = {},
): AreaSelectDep {
  const { scene } = world;
  const { entered } = opts;
  const scope = entered && createEnteredGroupScope({ entered, scene: scene as never });
  const tree = {
    getParent: (id: string) => scene.get(id as NodeId)?.parent ?? null,
    getNode: (id: string) => scene.get(id as NodeId),
  };
  return {
    hitTestArea: (bounds, view) => {
      const hits = worldPickIndex(world).inScreenRect(viewportOf(world, viewId), bounds, layerGateOf(view));
      return scope ? hits.filter((id) => scope.isPointerInteractive(id)) : hits;
    },
    ...(entered ? { targetOf: (id: string) => pressTarget(tree, id, entered.get()) } : {}),
    getSelection: () => [...selection.get()],
    setSelection: (ids) => selection.set([...ids]),
  };
}

/** Options for `createSnap`. */
export interface Snap3dOptions {
  /** What a gesture snaps to, in order: earlier wins a full tie. Two sharing
   *  an id throw. Default none, which leaves only the gesture's own constraint. */
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
  /** The view whose camera a gesture is cast through. Default the surface's. */
  viewId?: string | null;
}

let warnedGestureSources = false;

function warnGestureSources(): void {
  if (warnedGestureSources || !isDev()) return;
  warnedGestureSources = true;
  console.warn(
    '[kernel3d] a gesture passed snap `sources`, which are 2D and are not asked in a 3D host. ' +
    'List 3D sources in createSnap({ sources }).',
  );
}

/**
 * The `snap` dep over a 3D world. A gesture's `omit` is honored; its 2D
 * `sources` are not asked. A move snaps its subject's world box on the
 * plane it already moves on; an insert snaps the pointer on the ground. Both
 * answer in screen points, which `translate` and `createInsert` cast back
 * onto the same plane, landing where the snap put them to within rounding: a
 * grid snap can store a coordinate a few ulps off the line (docs/TODO.md).
 */
export function createSnap<TData, TLayer extends string>(
  world: World3d<TData, TLayer>, opts: Snap3dOptions = {},
): SnapDep {
  const store = opts.store ?? createSnapOutcomeStore<Vec3>();
  const listed = opts.sources ?? [];
  assertSnapSourceIds(listed);
  return {
    begin: (req) => {
      if (req.sources?.length) warnGestureSources();
      const omit = new Set(req.omit);
      const sources = listed.filter((s) => !omit.has(s.id));
      return createSession3d({
        req, world, sources, store, viewId: opts.viewId,
        reachPx: opts.reachPx ?? opts.kitSettings?.get('targets.snapPx') ?? DEFAULT_SNAP_PX,
      });
    },
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
  world: World3d<TData, TLayer>, viewId?: string | null,
): PoseDescriptor<Pose3, Node3d<TData, TLayer>> {
  const up = world.up ?? DEFAULT_UP;
  const upAxis = groundAxes(up).up;
  const specialized = new WeakMap<object, PoseDescriptor<Pose3, Node3d<TData, TLayer>>>();

  const castableViewport = castableViewportOf(world, viewId);

  function build(worldBox: (pose: Pose3) => Aabb): PoseDescriptor<Pose3, Node3d<TData, TLayer>> {
    const boundsIn = (vp: Viewport3d, pose: Pose3) =>
      projectAabbToScreen(worldBox(pose), viewProjectionOf(vp), rectOf(vp));
    const boundsOf = (pose: Pose3) => boundsIn(viewportOf(world, viewId), pose);

    const descriptor: PoseDescriptor<Pose3, Node3d<TData, TLayer>> = {
      forNode(node) {
        let d = specialized.get(node);
        if (!d) {
          // The pose arriving here is often an in-flight override rather than
          // `node.pose`, so the consumer is asked about that pose on this node
          // rather than about the node as committed.
          d = build((pose) => measuredBoxAt(world, node, pose));
          specialized.set(node, d);
        }
        return d;
      },

      getBounds(pose) {
        return boundsOf(pose) ?? OFF_SCREEN;
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
          x: from.x + (dst.x - src.x) + (from.x - src.x) * (kx - 1),
          y: from.y + (dst.y - src.y) + (from.y - src.y) * (ky - 1),
        };

        const plane = viewPlaneAt(vp, pose.position);
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
        const plane = viewPlaneAt(vp, template.position);

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
       * Screen-space deltas resolve against the plane the node already sits on. That
       * plane differs per node, so in a move of several each takes the lead's change
       * whole (it kept its height already), and the group moves as one body. */
      translate(pose, dx, dy, lead) {
        if (lead) return { ...pose, position: add(pose.position, sub(lead.to.position, lead.from.position)) };
        const vp = castableViewport();
        const box = vp && boundsIn(vp, pose);
        if (!vp || !box) return pose;
        const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const level = { normal: up, offset: dot(up, pose.position) };
        const before = onPlane(vp, level, from);
        const after = onPlane(vp, level, { x: from.x + dx, y: from.y + dy });
        return before && after ? movedOnLevel(pose, sub(after, before), upAxis) : pose;
      },

      supportsRotation() {
        return false;
      },
    };

    return descriptor;
  }

  return build((pose) => aabbOfPose(pose));
}
