/**
 * A viewport's two directions: a screen point to the ray it names, and a
 * world point to the screen point it draws at. Both speak the coordinate
 * space the host's pointer points arrive in.
 */

import { transformPoint4, type Ray, type Vec3 } from '@weasel-js/geom/3d';
import { cameraEye, cameraViewProjection, type Camera3d } from './camera';
import { ndcToScreen, rayThroughScreenPoint, type ScreenBox } from './screen';

/** The camera and the pane it draws into; `width`/`height` are the pane's
 *  size in the same units as the pointer points. */
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

/** Read on every dep call, so a dep always sees the current camera and pane. */
export type ViewportSource = () => Viewport3d;

type Point = { x: number; y: number };

/** The pane, in the coordinate space the host's points arrive in. The origin
 *  defaults to the client origin — a host that fills the window passes none. */
export function rectOf(viewport: Viewport3d): ScreenBox {
  return {
    x: viewport.originX ?? 0,
    y: viewport.originY ?? 0,
    width: viewport.width,
    height: viewport.height,
  };
}

export function viewProjectionOf(viewport: Viewport3d) {
  return cameraViewProjection(viewport.camera, viewport.width / Math.max(1, viewport.height));
}

export function rayAt(viewport: Viewport3d, point: Point): Ray | null {
  return rayThroughScreenPoint(
    point,
    rectOf(viewport),
    viewProjectionOf(viewport),
    cameraEye(viewport.camera),
  );
}

/** Where `p` draws in the viewport, or null when it is behind the near plane
 *  or projects to nothing finite. */
export function projectPoint(p: Vec3, viewport: Viewport3d): Point | null {
  const [x, y, z, w] = transformPoint4(viewProjectionOf(viewport), p);
  // GL's near plane is z = -w.
  if (!(w > 0) || z < -w) return null;
  const screen = ndcToScreen({ x: x / w, y: y / w }, rectOf(viewport));
  return Number.isFinite(screen.x) && Number.isFinite(screen.y) ? screen : null;
}
