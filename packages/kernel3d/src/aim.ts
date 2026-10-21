/**
 * A kernel3d viewport as a view aim: the frustum its camera shows, drawn into
 * any target view, and the pane itself as a target. Core's aim contract names
 * no 3D type, so this is the side that knows the camera.
 */

import type { AimOutline, AimPoint, AimSpace, ViewAim } from '@weasel-js/core';
import { add, dot, intersectRayPlane, normalize, pointOnRay, scale, sub, type Vec3 } from '@weasel-js/geom/3d';
import { cameraEye, type Camera3d } from './camera';
import { projectPoint, rayAt, rectOf, type Viewport3d } from './project';

type Quad = readonly [Vec3, Vec3, Vec3, Vec3];

/** The frustum a camera shows: its eye, and its near and far rectangles, corners clockwise from the top-left as seen. */
export interface Frustum3d {
  eye: Vec3;
  near: Quad;
  far: Quad;
}

/** A kernel3d view's aim: the frustum its camera sees, with the viewport it was read from. */
export type Aim3d = ViewAim<Frustum3d> & { readonly kind: 'frustum'; readonly viewport: Viewport3d };

const GROUND_NORMAL: Vec3 = { x: 0, y: 0, z: 1 };

function paneCorners(viewport: Viewport3d): { x: number; y: number }[] {
  const { x, y, width, height } = rectOf(viewport);
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function frustumOf(viewport: Viewport3d): Frustum3d {
  const { camera } = viewport;
  const eye = cameraEye(camera);
  const forward = normalize(sub(camera.target, eye));
  const at = (depth: number): Vec3[] =>
    paneCorners(viewport).map((c) => {
      const ray = rayAt(viewport, c);
      if (!ray) return eye;
      const d = normalize(ray.direction);
      return add(eye, scale(d, depth / dot(d, forward)));
    });
  return {
    eye,
    near: at(camera.near) as unknown as Quad,
    far: at(camera.far) as unknown as Quad,
  };
}

/** Where the ray through a point in the pane's own coordinates meets z = 0, or `null`. */
function groundHit(viewport: Viewport3d, point: { x: number; y: number }): Vec3 | null {
  const ray = rayAt(viewport, point);
  const t = ray && intersectRayPlane(ray, GROUND_NORMAL, 0);
  return ray && t !== null ? pointOnRay(ray, t) : null;
}

function toZ(p: AimPoint): Vec3 {
  return { x: p.x, y: p.y, z: p.z ?? 0 };
}

function projectAll(space: AimSpace, points: readonly AimPoint[]): AimOutline | null {
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    const px = space.project(p);
    if (!px) return null;
    out.push(px);
  }
  return out;
}

/** The aim of view `viewId` (`null`: a surface's root): the frustum `viewport`'s camera sees. */
export function aimOf3d(viewport: Viewport3d, viewId: string | null): Aim3d {
  const extent = frustumOf(viewport);
  return {
    viewId,
    kind: 'frustum',
    extent,
    viewport,
    outlineIn(space) {
      if (space.kind === '3d') return projectAll(space, extent.far);
      const onGround: Vec3[] = [];
      for (const c of paneCorners(viewport)) {
        const hit = groundHit(viewport, c);
        if (!hit) return null;
        onGround.push(hit);
      }
      return projectAll(space, onGround);
    },
    pannedIn(space, from, to) {
      const a = space.unproject(from);
      const b = space.unproject(to);
      if (!a || !b) return null;
      const { camera } = viewport;
      const target = add(camera.target, sub(toZ(b), toZ(a)));
      return aimOf3d({ ...viewport, camera: { ...camera, target } }, viewId);
    },
  };
}

/** A 3D pane as a target. It projects through `projectPoint` and unprojects onto the plane z = 0, where 2D worlds lie. */
export function aimSpace3d(viewport: Viewport3d, viewId: string | null): AimSpace {
  const { x: ox, y: oy } = rectOf(viewport);
  return {
    viewId,
    kind: '3d',
    size: { width: viewport.width, height: viewport.height },
    project(p) {
      const s = projectPoint(toZ(p), viewport);
      return s && { x: s.x - ox, y: s.y - oy };
    },
    unproject(px) {
      return groundHit(viewport, { x: px.x + ox, y: px.y + oy });
    },
  };
}

/** The camera an aim was read from, which is what a by-value source's writer sets. */
export function cameraOfAim3d(aim: Aim3d): Camera3d {
  return aim.viewport.camera;
}
