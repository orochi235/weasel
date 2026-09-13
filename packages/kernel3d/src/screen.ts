/**
 * The screen side of the kernel: where a pointer points, and what rectangle a
 * world box covers. This is the seam weasel's 2D chrome meets — everything
 * here speaks `Bounds`-shaped screen rectangles, which is why a 3D host can
 * pass the dispatcher's world point through unchanged.
 */

import {
  invert,
  normalize,
  sub,
  transformPoint,
  transformPoint4,
  type Aabb,
  type Mat4,
  type Ray,
  type Vec3,
} from '@weasel-js/geom/3d';

/** A pane's rectangle in CSS pixels, relative to the client. */
export interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A screen rectangle in the shape core's `Bounds` uses. */
export interface ScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A `ScreenBox` a host is being asked to outline. `tint` says why: warm for
 *  what is selected, cool for what the gesture in hand is proposing. */
export interface ChromeBox extends ScreenBox {
  tint?: 'selection' | 'gesture';
}

/** Screen point (y down, rect-relative) to normalized device coordinates (y up). */
export function screenToNdc(
  point: { x: number; y: number },
  rect: ViewportRect,
): { x: number; y: number } {
  return {
    x: ((point.x - rect.x) / rect.w) * 2 - 1,
    y: 1 - ((point.y - rect.y) / rect.h) * 2,
  };
}

export function ndcToScreen(
  ndc: { x: number; y: number },
  rect: ViewportRect,
): { x: number; y: number } {
  return {
    x: rect.x + (ndc.x * 0.5 + 0.5) * rect.w,
    y: rect.y + (1 - (ndc.y * 0.5 + 0.5)) * rect.h,
  };
}

/**
 * The ray a screen point names, given the camera that drew the rect. This is
 * the whole of what 3D picking needs from a pointer — which is why the world
 * point the dispatcher carries stays two numbers.
 *
 * `null` when the point names no ray: the view-projection has no inverse (a
 * camera on its own target, a degenerate projection) or the pane has no area.
 */
export function rayThroughScreenPoint(
  point: { x: number; y: number },
  rect: ViewportRect,
  viewProjection: Mat4,
  eye: Vec3,
): Ray | null {
  const inv = invert(viewProjection);
  if (!inv) return null;
  const ndc = screenToNdc(point, rect);
  const near = transformPoint(inv, [ndc.x, ndc.y, -1]);
  const far = transformPoint(inv, [ndc.x, ndc.y, 1]);
  const direction = normalize(sub(far, near));
  // normalize answers zero for a non-finite difference, which is no direction.
  if (direction[0] === 0 && direction[1] === 0 && direction[2] === 0) return null;
  return { origin: eye, direction };
}

type Clip = readonly [number, number, number, number];

/** Signed distance to the near plane in clip space; `>= 0` is in front of it.
 *  GL puts the near plane at `z = -w`. */
function nearSide(p: Clip): number {
  return p[2] + p[3];
}

function lerpClip(a: Clip, b: Clip, t: number): Clip {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

/** The three edges leaving corner `i` toward a higher bit, as bit masks. */
const EDGE_BITS = [1, 2, 4] as const;

/**
 * The screen rectangle a world-space box covers — the currency weasel's chrome
 * and `PoseDescriptor.getBounds` speak in. `null` when the box is entirely
 * behind the near plane.
 *
 * Each of the twelve edges is clipped against the near plane before it is
 * projected, rather than dropping the corners behind it. Dropping them reports
 * a box that is too small for anything straddling the near plane, and the error
 * grows as the camera moves in: a solid the pointer is inside of would outline
 * as a sliver, or as nothing.
 */
export function projectAabbToScreen(
  box: Aabb,
  viewProjection: Mat4,
  rect: ViewportRect,
): ScreenBox | null {
  const corners: Clip[] = [];
  for (let i = 0; i < 8; i++) {
    const corner: Vec3 = [
      i & 1 ? box.max[0] : box.min[0],
      i & 2 ? box.max[1] : box.min[1],
      i & 4 ? box.max[2] : box.min[2],
    ];
    corners.push(transformPoint4(viewProjection, corner));
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let any = false;

  const extend = (p: Clip): void => {
    if (!(p[3] > 0)) return;
    const screen = ndcToScreen({ x: p[0] / p[3], y: p[1] / p[3] }, rect);
    minX = Math.min(minX, screen.x);
    minY = Math.min(minY, screen.y);
    maxX = Math.max(maxX, screen.x);
    maxY = Math.max(maxY, screen.y);
    any = true;
  };

  for (let i = 0; i < 8; i++) {
    for (const bit of EDGE_BITS) {
      if (i & bit) continue;
      let a = corners[i];
      let b = corners[i | bit];
      const da = nearSide(a);
      const db = nearSide(b);
      if (da < 0 && db < 0) continue;
      if (da < 0) a = lerpClip(a, b, da / (da - db));
      else if (db < 0) b = lerpClip(b, a, db / (db - da));
      extend(a);
      extend(b);
    }
  }

  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
