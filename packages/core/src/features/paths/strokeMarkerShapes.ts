/**
 * The kit's built-in stroke-marker vocabulary.
 *
 * Every entry is authored with its anchor at the origin and pointing +X, so
 * the line arrives from -X and no geometry sits at positive X. Coordinates are
 * in units of `MarkerCtx.size`, which defaults to the resolved stroke width —
 * one definition is therefore correct at any line weight.
 *
 * Not to be confused with `./markers.ts`, which builds decorative chrome
 * shapes and is unrelated.
 */

import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '../../core/geometry/path';
import type { MarkerCtx, MarkerEntry } from '../../core/strokeMarkers';

function poly(pts: readonly number[], size: number, close = true): PolygonPath {
  const n = pts.length / 2;
  const commands = new Uint8Array(close ? n + 1 : n);
  commands[0] = PATH_M;
  for (let i = 1; i < n; i++) commands[i] = PATH_L;
  if (close) commands[n] = PATH_Z;
  const coords = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) coords[i] = pts[i] * size;
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

/** Circle of radius `r` centred at `cx`, in marker units. */
function circle(cx: number, r: number, size: number, segments = 32): PolygonPath {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push(cx + r * Math.cos(theta), r * Math.sin(theta));
  }
  return poly(pts, size);
}

export const BUILTIN_MARKERS: readonly MarkerEntry[] = [
  {
    id: 'arrow',
    inset: 3,
    path: ({ size }: MarkerCtx) => poly([0, 0, -3, -1.5, -3, 1.5], size),
  },
  {
    id: 'arrow-open',
    inset: 0,
    fill: 'none',
    outline: { width: 1 },
    // Open at the back, so the ribbon runs to the vertex and the arms meet it.
    path: ({ size }: MarkerCtx) =>
      poly([-2.17, -1.25, 0, 0, -2.17, 1.25], size, false),
  },
  {
    id: 'arrow-concave',
    inset: 3,
    path: ({ size }: MarkerCtx) => poly([0, 0, -3, -1.5, -2, 0, -3, 1.5], size),
  },
  {
    id: 'diamond',
    inset: 4,
    path: ({ size }: MarkerCtx) => poly([0, 0, -2, -1.2, -4, 0, -2, 1.2], size),
  },
  {
    id: 'diamond-hollow',
    inset: 4,
    fill: 'none',
    outline: { width: 0.5 },
    path: ({ size }: MarkerCtx) => poly([0, 0, -2, -1.2, -4, 0, -2, 1.2], size),
  },
  {
    id: 'circle',
    inset: 2,
    path: ({ size }: MarkerCtx) => circle(-1, 1, size),
  },
  {
    id: 'square',
    inset: 2,
    path: ({ size }: MarkerCtx) => poly([0, -1, 0, 1, -2, 1, -2, -1], size),
  },
  {
    id: 'bar',
    inset: 0,
    fill: 'none',
    outline: { width: 1 },
    path: ({ size }: MarkerCtx) => poly([0, -1.5, 0, 1.5], size, false),
  },
];
