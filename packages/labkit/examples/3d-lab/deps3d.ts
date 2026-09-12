/**
 * The kit deps, implemented against a 3D world.
 *
 * Every one of these takes its camera from a thunk rather than an argument.
 * That is the lab's central claim in code: the dispatcher keeps handing actions
 * two numbers, and what makes them mean something in 3D is the camera each dep
 * already closes over. Nothing here needs a wider `InvocationCtx`.
 *
 * Where a kit contract cannot be honored, the implementation throws rather than
 * guessing — a guess would make the lab report a fit it did not have.
 */

import type {
  AreaSelectDep,
  InsertDep,
  NodeAtPointDep,
  NodeId,
  PoseDescriptor,
  SnapDep,
} from '@weasel-js/core';
import { cameraEye, cameraViewProjection, type Camera3d } from './camera3d';
import {
  intersectRayAabb,
  intersectRayPlane,
  projectAabbToScreen,
  rayThroughScreenPoint,
  sub,
  type Rect,
  type Vec3,
} from './math3d';
import { aabbOfSolid, pose3, type Pose3, type SolidScene } from './scene3d';

export interface Viewport3d {
  camera: Camera3d;
  width: number;
  height: number;
  /**
   * Where the pane sits in client coordinates. The lab works in one space from
   * the event to the ray — see the note on `clientToWorld` in the instrument —
   * so the deps subtract this rather than the dispatcher.
   */
  originX?: number;
  originY?: number;
}

export type ViewportSource = () => Viewport3d;

/** The pane, in the coordinate space the lab's points arrive in. */
function rectOf(viewport: Viewport3d): Rect {
  return {
    x: viewport.originX ?? 0,
    y: viewport.originY ?? 0,
    w: viewport.width,
    h: viewport.height,
  };
}

function viewProjectionOf(viewport: Viewport3d) {
  return cameraViewProjection(viewport.camera, viewport.width / Math.max(1, viewport.height));
}

function rayAt(viewport: Viewport3d, point: { x: number; y: number }) {
  return rayThroughScreenPoint(
    point,
    rectOf(viewport),
    viewProjectionOf(viewport),
    cameraEye(viewport.camera),
  );
}

/** The screen box a node covers, or null when it projects to nothing visible. */
export function screenBoxOf(scene: SolidScene, id: NodeId, viewport: Viewport3d) {
  const node = scene.get(id);
  if (!node) return null;
  const { min, max } = aabbOfSolid(node.pose, node.data.kind);
  return projectAabbToScreen(min, max, viewProjectionOf(viewport), rectOf(viewport));
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

/**
 * Nearest solid along the ray the screen point names.
 *
 * The kit calls this with what it believes is a world point; the lab feeds the
 * dispatcher an identity `clientToWorld`, so it is the pane-relative screen
 * point, which is exactly what a ray needs.
 */
export function createNodeAtPoint(scene: SolidScene, viewport: ViewportSource): NodeAtPointDep {
  return (point, exclude) => {
    const excluded = exclude ? new Set(exclude) : null;
    const vp = viewport();
    const ray = rayAt(vp, point);
    let best: NodeId | null = null;
    let bestT = Infinity;
    for (const node of scene.renderOrderNodes()) {
      if (excluded?.has(node.id)) continue;
      const { min, max } = aabbOfSolid(node.pose, node.data.kind);
      const t = intersectRayAabb(ray, min, max);
      if (t !== null && t < bestT) {
        bestT = t;
        best = node.id;
      }
    }
    return best;
  };
}

/** Marquee: the solids whose projected box the screen rectangle touches. */
export function createAreaSelect(
  scene: SolidScene,
  viewport: ViewportSource,
  selection: { get(): readonly NodeId[]; set(ids: NodeId[]): void },
): AreaSelectDep {
  return {
    hitTestArea(bounds) {
      const vp = viewport();
      const hits: NodeId[] = [];
      for (const node of scene.renderOrderNodes()) {
        const box = screenBoxOf(scene, node.id, vp);
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

/**
 * A drag rectangle becomes a box standing on the ground plane: the rectangle's
 * corners are cast onto y=0 and the hit points give the footprint.
 *
 * The kit's `InsertDep.commit` hands over a screen-space AABB and nothing else,
 * which turns out to be enough — the depth the 2D contract cannot express comes
 * from the plane, not from the caller.
 */
export function createInsert(scene: SolidScene, viewport: ViewportSource): InsertDep {
  return {
    commit(bounds) {
      const vp = viewport();
      const corners = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x, y: bounds.y + bounds.height },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      ];

      const hits: Vec3[] = [];
      for (const corner of corners) {
        const ray = rayAt(vp, corner);
        const t = intersectRayPlane(ray, [0, 1, 0], 0);
        if (t === null) continue;
        hits.push([
          ray.origin[0] + ray.direction[0] * t,
          ray.origin[1] + ray.direction[1] * t,
          ray.origin[2] + ray.direction[2] * t,
        ]);
      }
      if (hits.length === 0) return null;

      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const h of hits) {
        minX = Math.min(minX, h[0]);
        maxX = Math.max(maxX, h[0]);
        minZ = Math.min(minZ, h[2]);
        maxZ = Math.max(maxZ, h[2]);
      }
      const width = Math.max(0.25, maxX - minX);
      const depth = Math.max(0.25, maxZ - minZ);
      const height = (width + depth) / 2;

      return scene.add({
        kind: 'leaf',
        layer: 'solids',
        pose: pose3([(minX + maxX) / 2, height / 2, (minZ + maxZ) / 2], [width, height, depth]),
        data: { kind: 'box', color: '#c49a3f' },
      });
    },
  };
}

/**
 * `PoseDescriptor` over a 3D pose, with `Bounds` read as the screen box the
 * solid covers. Chrome and marquee math work unchanged; the two methods that
 * run the other way cannot.
 *
 * Two contract mismatches worth naming, both recorded in the kernel doc:
 *   - it is handed a pose and never the node, so it cannot see which primitive
 *     it is describing and bounds every solid as a box;
 *   - a screen rectangle does not name a 3D pose without a depth, so
 *     `remapBounds` and `fromBounds` have no honest answer.
 */
export function createPoseDescriptor(viewport: ViewportSource): PoseDescriptor<Pose3> {
  const boundsOf = (pose: Pose3) => {
    const vp = viewport();
    const { min, max } = aabbOfSolid(pose, 'box');
    return projectAabbToScreen(min, max, viewProjectionOf(vp), rectOf(vp));
  };

  return {
    getBounds(pose) {
      return boundsOf(pose) ?? { x: 0, y: 0, width: 0, height: 0 };
    },

    remapBounds() {
      throw new Error(
        '3d-lab: remapBounds has no 3D answer — a screen rectangle does not name a pose without a depth.',
      );
    },

    fromBounds() {
      throw new Error(
        '3d-lab: fromBounds has no 3D answer — a screen rectangle does not name a pose without a depth.',
      );
    },

    /**
     * Screen-space deltas resolve against the horizontal plane the solid already
     * sits on, so the two numbers the kit passes are enough: the camera that
     * turns them into a world position is the one this dep closed over.
     */
    translate(pose, dx, dy) {
      const vp = viewport();
      const box = boundsOf(pose);
      if (!box) return pose;
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const to = { x: from.x + dx, y: from.y + dy };

      const ray = rayAt(vp, to);
      const t = intersectRayPlane(ray, [0, 1, 0], pose.position[1]);
      if (t === null) return pose;

      const anchorRay = rayAt(vp, from);
      const anchorT = intersectRayPlane(anchorRay, [0, 1, 0], pose.position[1]);
      if (anchorT === null) return pose;

      const hit: Vec3 = [
        ray.origin[0] + ray.direction[0] * t,
        ray.origin[1] + ray.direction[1] * t,
        ray.origin[2] + ray.direction[2] * t,
      ];
      const anchor: Vec3 = [
        anchorRay.origin[0] + anchorRay.direction[0] * anchorT,
        anchorRay.origin[1] + anchorRay.direction[1] * anchorT,
        anchorRay.origin[2] + anchorRay.direction[2] * anchorT,
      ];
      const delta = sub(hit, anchor);

      return {
        ...pose,
        position: [
          pose.position[0] + delta[0],
          pose.position[1],
          pose.position[2] + delta[2],
        ],
      };
    },

    intersectsRect(pose, rect) {
      const box = boundsOf(pose);
      return box ? overlaps(box, rect) : false;
    },

    supportsRotation() {
      return false;
    },
  };
}
