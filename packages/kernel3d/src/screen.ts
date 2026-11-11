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

/** A screen rectangle in CSS pixels, in the shape core's `Bounds` uses. Both
 *  a pane's own rect and a projected world box are this — one spelling, so the
 *  two never need converting between. */
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
  rect: ScreenBox,
): { x: number; y: number } {
  return {
    x: ((point.x - rect.x) / rect.width) * 2 - 1,
    y: 1 - ((point.y - rect.y) / rect.height) * 2,
  };
}

/** Inverse of `screenToNdc`: normalized device coordinates (y up) to a point
 *  in `rect`'s space (y down). */
export function ndcToScreen(
  ndc: { x: number; y: number },
  rect: ScreenBox,
): { x: number; y: number } {
  return {
    x: rect.x + (ndc.x * 0.5 + 0.5) * rect.width,
    y: rect.y + (1 - (ndc.y * 0.5 + 0.5)) * rect.height,
  };
}

/**
 * The ray a screen point names, given the camera that drew the rect. This is
 * the whole of what 3D picking needs from a pointer — which is why the world
 * point the dispatcher carries stays two numbers.
 *
 * It runs from the near plane to the far plane, so `t` from 0 to 1 spans what
 * the camera draws: nothing clipped away in front of the near plane or past
 * the far one is on it.
 *
 * `null` when the point names no ray: the view-projection has no inverse (a
 * camera on its own target, a degenerate projection) or the pane has no area.
 */
export function rayThroughScreenPoint(
  point: { x: number; y: number },
  rect: ScreenBox,
  viewProjection: Mat4,
): Ray | null {
  const inv = invert(viewProjection);
  if (!inv) return null;
  const ndc = screenToNdc(point, rect);
  const near = transformPoint(inv, { x: ndc.x, y: ndc.y, z: -1 });
  const far = transformPoint(inv, { x: ndc.x, y: ndc.y, z: 1 });
  const direction = sub(far, near);
  // normalize answers zero for a non-finite difference, which is no direction.
  const unit = normalize(direction);
  if (unit.x === 0 && unit.y === 0 && unit.z === 0) return null;
  return { origin: near, direction };
}

type Clip = readonly [number, number, number, number];

/** Signed distances to the near and far planes in clip space; `>= 0` is the
 *  side the camera draws. GL puts them at `z = -w` and `z = w`. */
const CLIP_SIDES: readonly ((p: Clip) => number)[] = [
  (p) => p[2] + p[3],
  (p) => p[3] - p[2],
];

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
 * and `PoseDescriptor.getBounds` speak in. `null` when none of the box lies
 * between the near and far planes, which is when the camera draws none of it.
 *
 * Each of the twelve edges is clipped against the near and far planes before
 * it is projected, rather than dropping the corners behind the camera.
 * Dropping them reports a box that is too small for anything straddling the
 * near plane, and the error grows as the camera moves in: a solid the pointer
 * is inside of would outline as a sliver, or as nothing.
 */
export function projectAabbToScreen(
  box: Aabb,
  viewProjection: Mat4,
  rect: ScreenBox,
): ScreenBox | null {
  if (!(rect.width > 0 && rect.height > 0)) return null;
  const corners: Clip[] = [];
  for (let i = 0; i < 8; i++) {
    const corner: Vec3 = {
      x: i & 1 ? box.max.x : box.min.x,
      y: i & 2 ? box.max.y : box.min.y,
      z: i & 4 ? box.max.z : box.min.z,
    };
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
      const a = corners[i];
      const b = corners[i | bit];
      let t0 = 0;
      let t1 = 1;
      for (const side of CLIP_SIDES) {
        const da = side(a);
        const db = side(b);
        // A side that is NaN, as every depth is under planes with no depth between them, draws nothing.
        if (Number.isNaN(da) || Number.isNaN(db) || (da < 0 && db < 0)) { t0 = 1; t1 = 0; break; }
        if (da < 0) t0 = Math.max(t0, da / (da - db));
        else if (db < 0) t1 = Math.min(t1, da / (da - db));
      }
      if (t0 > t1) continue;
      extend(t0 === 0 ? a : lerpClip(a, b, t0));
      extend(t1 === 1 ? b : lerpClip(a, b, t1));
    }
  }

  if (!any) return null;
  const out = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  return Number.isFinite(out.x + out.y + out.width + out.height) ? out : null;
}
