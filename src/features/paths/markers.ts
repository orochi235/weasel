/**
 * Ergonomic builders for tiny shape paths used by chrome / overlays / markers.
 *
 * These don't expand the `DrawCommand` union — they all return `PolygonPath`,
 * which `PathDrawCommand.path` already accepts. The wins are:
 *   - One place owns the math (`circlePath`'s segment loop, `squarePath`'s
 *     corner unrolling), so consumers don't reinvent it.
 *   - Default segment counts can be tuned in one place if "circles look
 *     facety" feedback ever surfaces.
 *
 * Not appropriate for *user-drawn* shapes (those have a pose and live in the
 * scene). Use these for selection chrome, anchor markers, rubber-band rects,
 * and similar transient/decorative geometry.
 */

import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from './types';

/**
 * N-segment polygon approximation of a circle. Default 32 segments → max
 * radial deviation of ≈0.005·r (≈0.05 px at r=10). Bump higher for large
 * filled circles where the facets become visible; the default is fine for
 * the handle-dot / anchor-dot scale we use everywhere.
 */
export function circlePath(cx: number, cy: number, r: number, segments = 32): PolygonPath {
  const cmds = new Uint8Array(segments + 1);
  const coords = new Float32Array(segments * 2);
  cmds[0] = PATH_M;
  coords[0] = cx + r;
  coords[1] = cy;
  for (let i = 1; i < segments; i++) {
    cmds[i] = PATH_L;
    const theta = (i / segments) * Math.PI * 2;
    coords[i * 2] = cx + r * Math.cos(theta);
    coords[i * 2 + 1] = cy + r * Math.sin(theta);
  }
  cmds[segments] = PATH_Z;
  return { kind: 'polygon', commands: cmds, coords, fillRule: 'nonzero' };
}

/** Axis-aligned square centred at (cx, cy) with side length `size`. */
export function squarePath(cx: number, cy: number, size: number): PolygonPath {
  const half = size / 2;
  const x0 = cx - half, y0 = cy - half;
  const x1 = cx + half, y1 = cy + half;
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]),
    fillRule: 'nonzero',
  };
}

/** Axis-aligned rectangle. Top-left at (x, y), width/height as given. */
export function rectMarkerPath(x: number, y: number, width: number, height: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([x, y, x + width, y, x + width, y + height, x, y + height]),
    fillRule: 'nonzero',
  };
}

/** Open line segment from (ax, ay) to (bx, by). No close. */
export function linePath(ax: number, ay: number, bx: number, by: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([ax, ay, bx, by]),
    fillRule: 'nonzero',
  };
}
