import { normalizeZoom } from '@weasel-js/core';
import { type Camera3d, clampCamera, createCamera, type OrbitLimits } from '@weasel-js/kernel3d';
import type { ViewTransform } from '../instrument/types';

/** The 2D view labkit has always shipped, and what a trial gets when it names no
 *  other. Re-exported under its own name so a consumer can say which it means. */
export type ViewTransform2D = ViewTransform;

/** Zoom 1, no pan. */
export const DEFAULT_VIEW: ViewTransform2D = { zoom: 1, pan: { x: 0, y: 0 } };

/** A trial's view is opaque to labkit, so anything that needs the 2D shape — the
 *  zoom chrome, `CanvasStack` — asks for it and handles not getting it. */
export function as2DView(view: unknown): ViewTransform2D | null {
  if (typeof view !== 'object' || view === null) return null;
  const v = view as Partial<ViewTransform2D>;
  if (typeof v.zoom !== 'number') return null;
  if (typeof v.pan !== 'object' || v.pan === null) return null;
  if (typeof v.pan.x !== 'number' || typeof v.pan.y !== 'number') return null;
  return normalize2DView({ zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y } });
}

/** `view` inside the invariant every view holds: a zoom that is not a finite
 *  number of at least `ZOOM_FLOOR` becomes the floor, and a non-finite pan
 *  becomes 0. Returns `view` itself when it already holds. */
export function normalize2DView(view: ViewTransform2D): ViewTransform2D {
  const zoom = normalizeZoom(view.zoom);
  const x = Number.isFinite(view.pan.x) ? view.pan.x : 0;
  const y = Number.isFinite(view.pan.y) ? view.pan.y : 0;
  if (zoom === view.zoom && x === view.pan.x && y === view.pan.y) return view;
  return { zoom, pan: { x, y } };
}

/** An orbit trial's view: kernel3d's camera, held as plain numbers. */
export type ViewTransform3D = Camera3d;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** The 3D counterpart of `as2DView`: the view as an orbit camera, or `null`
 *  when it is not one. A lens field that is missing or unusable gets its
 *  default, and pitch and distance come back inside `limits`. Returns `view`
 *  itself when it already holds. */
export function as3DView(view: unknown, limits?: Partial<OrbitLimits>): ViewTransform3D | null {
  if (typeof view !== 'object' || view === null) return null;
  const v = view as Partial<Record<keyof Camera3d, unknown>>;
  const t = v.target as Partial<Record<'x' | 'y' | 'z', unknown>> | undefined;
  if (!finite(v.yaw) || !finite(v.pitch) || !finite(v.distance) || !(v.distance > 0)) return null;
  if (typeof t !== 'object' || t === null || !finite(t.x) || !finite(t.y) || !finite(t.z)) {
    return null;
  }
  const positive = (n: unknown): n is number => finite(n) && n > 0;
  const whole = positive(v.fov) && positive(v.near) && positive(v.far);
  const camera = whole
    ? (view as Camera3d)
    : createCamera({
        target: { x: t.x, y: t.y, z: t.z },
        yaw: v.yaw,
        pitch: v.pitch,
        distance: v.distance,
        ...(positive(v.fov) ? { fov: v.fov } : {}),
        ...(positive(v.near) ? { near: v.near } : {}),
        ...(positive(v.far) ? { far: v.far } : {}),
      });
  return clampCamera(camera, limits);
}

/** `view` at a new zoom, through the same rule. */
export function withZoom(view: ViewTransform2D, zoom: number): ViewTransform2D {
  return normalize2DView({ zoom, pan: view.pan });
}
