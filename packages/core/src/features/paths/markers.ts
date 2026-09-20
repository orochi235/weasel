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
import { rectToContour } from '@weasel-js/geom';

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
    coords: Float32Array.from(rectToContour(x, y, width, height)),
    fillRule: 'nonzero',
  };
}

/**
 * Axis-aligned rounded rectangle. Top-left at (x, y); `r` is clamped to half
 * the shorter side. Each corner is `cornerSamples` line segments, matching
 * `circlePath`'s polygonal approximation — the default 8 gives the same
 * angular resolution as `circlePath`'s 32.
 */
export function roundRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
  cornerSamples = 8,
): PolygonPath {
  const radius = Math.max(0, Math.min(r, Math.min(width, height) / 2));
  if (radius === 0) return rectMarkerPath(x, y, width, height);

  const HALF_PI = Math.PI / 2;
  // Corner centers paired with the arc's start angle, walked clockwise in
  // screen space from the top-left.
  const corners: Array<[number, number, number]> = [
    [x + radius, y + radius, Math.PI],
    [x + width - radius, y + radius, -HALF_PI],
    [x + width - radius, y + height - radius, 0],
    [x + radius, y + height - radius, HALF_PI],
  ];

  const perCorner = cornerSamples + 1;
  const count = corners.length * perCorner;
  const cmds = new Uint8Array(count + 1);
  const coords = new Float32Array(count * 2);
  let i = 0;
  for (const [cx, cy, start] of corners) {
    for (let s = 0; s <= cornerSamples; s++) {
      const theta = start + (s / cornerSamples) * HALF_PI;
      cmds[i] = i === 0 ? PATH_M : PATH_L;
      coords[i * 2] = cx + radius * Math.cos(theta);
      coords[i * 2 + 1] = cy + radius * Math.sin(theta);
      i++;
    }
  }
  cmds[count] = PATH_Z;
  return { kind: 'polygon', commands: cmds, coords, fillRule: 'nonzero' };
}
