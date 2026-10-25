/**
 * The kit's built-in stroke-marker vocabulary.
 *
 * Every entry is authored with its anchor at the origin and pointing +X, so
 * the line arrives from -X and no geometry sits at positive X. Coordinates are
 * in units of `MarkerCtx.size`, which defaults to the resolved stroke width —
 * one definition is therefore correct at any line weight.
 *
 * Not to be confused with `features/paths/markers.ts`, which builds
 * decorative chrome shapes and is unrelated.
 */

import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import type { MarkerCtx, MarkerEntry } from './strokeMarkers';

/** One path of several subpaths, each a flat `[x, y, …]` list in marker
 *  units and closed or left open. */
function subpaths(size: number, ...parts: ReadonlyArray<readonly [readonly number[], boolean]>): PolygonPath {
  let nCmds = 0;
  let nCoords = 0;
  for (const [pts, close] of parts) {
    nCmds += pts.length / 2 + (close ? 1 : 0);
    nCoords += pts.length;
  }
  const commands = new Uint8Array(nCmds);
  const coords = new Float32Array(nCoords);
  let c = 0;
  let k = 0;
  for (const [pts, close] of parts) {
    for (let i = 0; i < pts.length; i += 2) {
      commands[c++] = i === 0 ? PATH_M : PATH_L;
      coords[k++] = pts[i] * size;
      coords[k++] = pts[i + 1] * size;
    }
    if (close) commands[c++] = PATH_Z;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

function poly(pts: readonly number[], size: number, close = true): PolygonPath {
  return subpaths(size, [pts, close]);
}

/** A circle of radius `r` centred at `(cx, 0)`, in marker units, as a flat point list. */
function circlePoints(cx: number, r: number, segments = 32): number[] {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push(cx + r * Math.cos(theta), r * Math.sin(theta));
  }
  return pts;
}

function circle(cx: number, r: number, size: number): PolygonPath {
  return poly(circlePoints(cx, r), size);
}

// Proportions proofed at 12x: bars 2 apart leave a clear gap at outline
// width 1, and a foot narrower than ±2.5 reads as an arrowhead.
/** A crow's-foot bar across the line at `x`. */
const crowBar = (x: number) => [[x, -2, x, 2], false] as const;
/** The foot's two outer prongs; the line itself is the middle one. */
const CROW_FOOT = [[[-4, 0, 0, -2.5], false], [[-4, 0, 0, 2.5], false]] as const;
const ZERO_R = 2;
/** The hollow circle of a zero-minimum, and the run of line from its front to
 *  the anchor that the ribbon, stopping at its back, no longer draws. */
const crowZero = (cx: number) => [[circlePoints(cx, ZERO_R), true], [[cx + ZERO_R, 0, 0, 0], false]] as const;

/** Every crow's-foot head: open strokes as thick as the line, nothing filled. */
const CROW = { reads: [], fill: 'none', outline: { width: 1 } } as const;

/** The markers the registry is seeded with: `arrow`, `arrow-open`,
 *  `arrow-concave`, `triangle-hollow`, `diamond`, `diamond-hollow`, `circle`,
 *  `square`, `bar`, and the crow's-foot family `crow-one`, `crow-many`,
 *  `crow-zero-one`, `crow-one-many`, and `crow-zero-many`. */
export const BUILTIN_MARKERS: readonly MarkerEntry[] = [
  {
    id: 'arrow',
    reads: [],
    inset: 3,
    path: ({ size }: MarkerCtx) => poly([0, 0, -3, -1.5, -3, 1.5], size),
  },
  {
    id: 'arrow-open',
    reads: [],
    inset: 0,
    fill: 'none',
    outline: { width: 1 },
    // Open at the back, so the ribbon runs to the vertex and the arms meet it.
    // Arms 3.5 long at ±35°: the back opening is 4 units against 2 units of
    // arm, so the V still reads open. Shorter or narrower and the two arms
    // close the gap themselves and it paints as a solid triangle.
    path: ({ size }: MarkerCtx) =>
      poly([-2.867, -2.007, 0, 0, -2.867, 2.007], size, false),
  },
  {
    id: 'arrow-concave',
    reads: [],
    inset: 3,
    path: ({ size }: MarkerCtx) => poly([0, 0, -3, -1.5, -2, 0, -3, 1.5], size),
  },
  {
    id: 'triangle-hollow',
    reads: [],
    // Inset to its back edge, so the line does not show through the hollow.
    inset: 4,
    fill: 'none',
    outline: { width: 0.5 },
    path: ({ size }: MarkerCtx) => poly([0, 0, -4, -2, -4, 2], size),
  },
  {
    id: 'diamond',
    reads: [],
    inset: 4,
    path: ({ size }: MarkerCtx) => poly([0, 0, -2, -1.2, -4, 0, -2, 1.2], size),
  },
  {
    id: 'diamond-hollow',
    reads: [],
    inset: 4,
    fill: 'none',
    outline: { width: 0.5 },
    path: ({ size }: MarkerCtx) => poly([0, 0, -2, -1.2, -4, 0, -2, 1.2], size),
  },
  {
    id: 'circle',
    reads: [],
    inset: 2,
    path: ({ size }: MarkerCtx) => circle(-1, 1, size),
  },
  {
    id: 'square',
    reads: [],
    inset: 2,
    path: ({ size }: MarkerCtx) => poly([0, -1, 0, 1, -2, 1, -2, -1], size),
  },
  {
    id: 'bar',
    reads: [],
    inset: 0,
    fill: 'none',
    outline: { width: 1 },
    path: ({ size }: MarkerCtx) => poly([0, -1.5, 0, 1.5], size, false),
  },
  // Nearest the anchor is the maximum (one or many), behind it the minimum.
  {
    id: 'crow-one',
    ...CROW,
    inset: 0,
    // The run to the anchor repeats the line beneath it, and puts the head's
    // leading edge on the anchor as every marker's is.
    path: ({ size }: MarkerCtx) => subpaths(size, crowBar(-2), crowBar(-4), [[-4, 0, 0, 0], false]),
  },
  {
    id: 'crow-many',
    ...CROW,
    inset: 0,
    path: ({ size }: MarkerCtx) => subpaths(size, ...CROW_FOOT),
  },
  {
    id: 'crow-zero-one',
    ...CROW,
    inset: 7.5,
    path: ({ size }: MarkerCtx) => subpaths(size, crowBar(-2), ...crowZero(-5.5)),
  },
  {
    id: 'crow-one-many',
    ...CROW,
    inset: 0,
    path: ({ size }: MarkerCtx) => subpaths(size, ...CROW_FOOT, crowBar(-5.5)),
  },
  {
    id: 'crow-zero-many',
    ...CROW,
    inset: 9.5,
    path: ({ size }: MarkerCtx) => subpaths(size, ...CROW_FOOT, ...crowZero(-7.5)),
  },
];
