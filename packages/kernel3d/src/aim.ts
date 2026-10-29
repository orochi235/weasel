/**
 * A kernel3d viewport as a view aim: the frustum its camera shows, drawn into
 * any target view, and the pane itself as a target. Core's aim contract names
 * no 3D type, so this is the side that knows the camera.
 */

import type { AimOutline, AimPoint, AimSpace, ViewAim } from '@weasel-js/core';
import { add, dot, normalize, scale, sub, type Vec3 } from '@weasel-js/geom/3d';
import { cameraEye, type Camera3d } from './camera';
import { fromAimPoint, groundAxes, groundHit, toAimPoint, type GroundAxes } from './ground';
import { projectPoint, rayAt, rectOf, type Viewport3d } from './project';
import { DEFAULT_UP } from './world';

type Quad = readonly [Vec3, Vec3, Vec3, Vec3];

/** The frustum a camera shows: its eye, and its near and far rectangles, corners clockwise from the top-left as seen. */
export interface Frustum3d {
  eye: Vec3;
  near: Quad;
  far: Quad;
}

/** A kernel3d view's aim: the frustum its camera sees, with the viewport it was read from. */
export type Aim3d = ViewAim<Frustum3d> & { readonly kind: 'frustum'; readonly viewport: Viewport3d };

/** How a kernel3d view meets a 2D one. */
export interface Aim3dOptions {
  /** The axis the ground, where a 2D world lies, is at right angles to: `createInsert`'s `up`. Default `+y`. */
  up?: Vec3;
}

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

/**
 * Where the frustum meets the ground, in the 2D world's terms, its edges' crossings wound about their middle: the
 * stretch of the ground the camera sees, cut off at its far plane, so a view with the horizon in it still outlines
 * the ground it shows. `null` when the frustum meets the ground in less than an area.
 */
function footprint(f: Frustum3d, up: Vec3, axes: GroundAxes): AimPoint[] | null {
  const edges: [Vec3, Vec3][] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    edges.push([f.near[i]!, f.near[j]!], [f.far[i]!, f.far[j]!], [f.near[i]!, f.far[i]!]);
  }
  const hits: AimPoint[] = [];
  for (const [a, b] of edges) {
    const ha = dot(a, up), hb = dot(b, up);
    if ((ha > 0 && hb > 0) || (ha < 0 && hb < 0) || ha === hb) continue;
    const hit = toAimPoint(add(a, scale(sub(b, a), ha / (ha - hb))), axes);
    hits.push({ x: hit.x, y: hit.y });
  }
  if (hits.length < 3) return null;
  const cx = hits.reduce((s, p) => s + p.x, 0) / hits.length;
  const cy = hits.reduce((s, p) => s + p.y, 0) / hits.length;
  const around = hits
    .map((p) => ({ p, a: Math.atan2(p.y - cy, p.x - cx) }))
    .sort((u, v) => u.a - v.a)
    .map((u) => u.p)
    .filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1]!.x, p.y - all[i - 1]!.y) > 1e-9);
  return around.length >= 3 ? around : null;
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

/**
 * The aim of view `viewId` (`null`: a surface's root): the frustum `viewport`'s camera sees. Drawn into a 2D view, it
 * outlines its footprint on the ground, the ground's two axes carrying the 2D world's x and y.
 */
export function aimOf3d(viewport: Viewport3d, viewId: string | null, opts: Aim3dOptions = {}): Aim3d {
  const up = opts.up ?? DEFAULT_UP;
  const axes = groundAxes(up);
  const extent = frustumOf(viewport);
  return {
    viewId,
    kind: 'frustum',
    extent,
    viewport,
    outlineIn(space) {
      if (space.kind === '3d') return projectAll(space, extent.far.map((p) => toAimPoint(p, axes)));
      const onGround = footprint(extent, up, axes);
      return onGround && projectAll(space, onGround);
    },
    pannedIn(space, from, to) {
      const a = space.unproject(from);
      const b = space.unproject(to);
      if (!a || !b) return null;
      const { camera } = viewport;
      const target = add(camera.target, sub(fromAimPoint(b, axes), fromAimPoint(a, axes)));
      return aimOf3d({ ...viewport, camera: { ...camera, target } }, viewId, opts);
    },
  };
}

/**
 * A 3D pane as a target. Its points are aim points: x and y along the ground's two axes and z, height, along `up`,
 * so a 2D world's points lie on the ground. It projects through `projectPoint` and unprojects onto the ground.
 */
export function aimSpace3d(viewport: Viewport3d, viewId: string | null, opts: Aim3dOptions = {}): AimSpace {
  const up = opts.up ?? DEFAULT_UP;
  const axes = groundAxes(up);
  const { x: ox, y: oy } = rectOf(viewport);
  return {
    viewId,
    kind: '3d',
    size: { width: viewport.width, height: viewport.height },
    project(p) {
      const s = projectPoint(fromAimPoint(p, axes), viewport);
      return s && { x: s.x - ox, y: s.y - oy };
    },
    unproject(px) {
      const hit = groundHit(viewport, { x: px.x + ox, y: px.y + oy }, up);
      return hit && toAimPoint(hit, axes);
    },
  };
}

/** The camera an aim was read from, which is what a by-value source's writer sets. */
export function cameraOfAim3d(aim: Aim3d): Camera3d {
  return aim.viewport.camera;
}
