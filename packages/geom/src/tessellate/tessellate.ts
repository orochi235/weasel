import earcut from 'earcut';
import { forEachSegment, PATH_M, PATH_L, PATH_Z, PATH_C, PATH_Q } from '../commands';
import { resolveCorners } from '../paths/corners';
import { coordsFrom, originFor } from '../paths/pathOrigin';
import { rectToContour } from '../box';
import type { Path, PolygonPath, RectPath } from '../path';
import { fillsOpenSubpaths } from '../openFill';
import {
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
} from '../flatten';
import type { Mesh } from './mesh';
import { resolveCrossings, resolveEvenOdd, type FlattenedContours } from './crossings';
import { nestRings, type Ring } from './nesting';
import { evenOddRings } from './evenOdd';

/** Options for `tessellate`. A smaller tolerance means more triangles and
 *  smoother curves; it is in path-local units, so callers rendering at a
 *  larger scale should tighten it. */
export interface TessellateOptions {
  /** Flatness tolerance for bezier subdivision in path-local units. */
  flattenTolerance?: number;
}

/** Turn a path into a triangle mesh the renderer can draw: curves flattened to
 *  line segments, then the resulting polygon triangulated. */
export function tessellate(path: Path, opts: TessellateOptions = {}): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  const mesh = tessellatePolygon(resolveCorners(path), opts);
  return path.origin ? { ...mesh, origin: path.origin } : mesh;
}

function tessellateRect(p: RectPath): Mesh {
  const corners = rectToContour(p.x, p.y, p.width, p.height);
  const origin = originFor(corners);
  return {
    vertices: coordsFrom(origin, corners),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    anchorA: new Uint32Array([0, 1, 2, 3]),
    anchorB: new Uint32Array([0, 1, 2, 3]),
    anchorT: new Float32Array([0, 0, 0, 0]),
    ...(origin ? { origin } : {}),
  };
}

/** The contours a fill covers: all of them, or only those a `Z` closed. */
export function flattenPolygon(p: PolygonPath, tolerance: number): FlattenedContours {
  const closed = new Set<number>();
  const all = flattenContours(p, tolerance, closed);
  if (fillsOpenSubpaths(p)) return all;
  const kept: FlattenedContours = { coords: [], contourStarts: [], anchorA: [], anchorB: [], anchorT: [] };
  all.contourStarts.forEach((start, c) => {
    if (!closed.has(c)) return;
    const end = c + 1 < all.contourStarts.length ? all.contourStarts[c + 1] : all.coords.length / 2;
    kept.contourStarts.push(kept.coords.length / 2);
    kept.coords.push(...all.coords.slice(start * 2, end * 2));
    kept.anchorA.push(...all.anchorA.slice(start, end));
    kept.anchorB.push(...all.anchorB.slice(start, end));
    kept.anchorT.push(...all.anchorT.slice(start, end));
  });
  return kept;
}

/** Flatten every contour, noting in `closed` the index of each one a `Z` ends. */
function flattenContours(p: PolygonPath, tolerance: number, closed: Set<number>): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const anchorA: number[] = [];
  const anchorB: number[] = [];
  const anchorT: number[] = [];
  const contourStarts: number[] = [];
  let startAnchor = -1;
  let prevAnchor = -1;
  let anchorCounter = 0;

  // Anchor bookkeeping for the points a curve just appended: interior points
  // interpolate (prevAnchor → target); the last is pinned anchor-exact.
  const pushCurveAnchors = (anchorStart: number, arcAccum: number[], total: number, target: number): void => {
    for (let k = 0; k < arcAccum.length; k++) {
      anchorA.push(prevAnchor);
      anchorB.push(target);
      anchorT.push(total > 0 ? arcAccum[k] / total : 0);
    }
    const lastIdx = anchorStart + arcAccum.length - 1;
    anchorA[lastIdx] = target;
    anchorB[lastIdx] = target;
    anchorT[lastIdx] = 0;
  };

  forEachSegment(commands, coords, (cmd, coordIdx, prevX, prevY, _i, opensSubpath) => {
    if (opensSubpath) {
      const anchor = Math.max(startAnchor, 0);
      contourStarts.push(out.length / 2);
      out.push(prevX, prevY);
      anchorA.push(anchor);
      anchorB.push(anchor);
      anchorT.push(0);
      prevAnchor = anchor;
    }
    switch (cmd) {
      case PATH_M:
      case PATH_L: {
        if (cmd === PATH_M) {
          contourStarts.push(out.length / 2);
          startAnchor = anchorCounter;
        }
        out.push(coords[coordIdx], coords[coordIdx + 1]);
        anchorA.push(anchorCounter);
        anchorB.push(anchorCounter);
        anchorT.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        break;
      }
      case PATH_Q: {
        const target = anchorCounter;
        const arcAccum: number[] = [];
        const anchorStart = anchorA.length;
        const total = flattenQuadraticWithArcLen(
          prevX, prevY,
          coords[coordIdx], coords[coordIdx + 1],
          coords[coordIdx + 2], coords[coordIdx + 3],
          tolerance, out, arcAccum,
        );
        pushCurveAnchors(anchorStart, arcAccum, total, target);
        prevAnchor = target;
        anchorCounter++;
        break;
      }
      case PATH_C: {
        const target = anchorCounter;
        const arcAccum: number[] = [];
        const anchorStart = anchorA.length;
        const total = flattenCubicWithArcLen(
          prevX, prevY,
          coords[coordIdx], coords[coordIdx + 1],
          coords[coordIdx + 2], coords[coordIdx + 3],
          coords[coordIdx + 4], coords[coordIdx + 5],
          tolerance, out, arcAccum,
        );
        pushCurveAnchors(anchorStart, arcAccum, total, target);
        prevAnchor = target;
        anchorCounter++;
        break;
      }
      case PATH_Z:
        closed.add(contourStarts.length - 1);
        // The pen returns to the subpath start (forEachSegment does that); the
        // anchor it carries has to follow, or a curve after the Z interpolates
        // from the wrong end.
        prevAnchor = startAnchor;
        break;
      default:
        throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  });

  return { coords: out, contourStarts, anchorA, anchorB, anchorT };
}

function tessellatePolygon(p: PolygonPath, opts: TessellateOptions): Mesh {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const flat = flattenPolygon(p, tolerance);

  if (p.fillRule === 'evenodd') {
    const rings = evenOddRings(flat);
    if (rings) return tessellateNonzero(flat, rings);
    const resolved = resolveEvenOdd(flat);
    if (resolved) return tessellateNonzero(resolved, nestRings(resolved));
    const { coords, contourStarts, anchorA, anchorB, anchorT } = flat;
    return tessellateEvenoddWithAnchors(coords, contourStarts, anchorA, anchorB, anchorT);
  }
  const crossed = resolveCrossings(flat);
  if (crossed) return tessellateNonzero(crossed, nestRings(crossed));
  const rings = nestRings(flat);
  if (rings.every((r) => Math.abs(r.winding) <= 1)) return tessellateNonzero(flat, rings);
  // Nested same-wound rings would cover the region they share twice.
  const rebuilt = resolveCrossings(flat, true)!;
  return tessellateNonzero(rebuilt, nestRings(rebuilt));
}

/** Triangulate rings that do not cross and wind at most once anywhere: each
 *  ring with fill inside it, less the rings directly inside it, which are its
 *  holes. */
function tessellateNonzero(flat: FlattenedContours, rings: Ring[]): Mesh {
  const { coords, contourStarts, anchorA, anchorB, anchorT } = flat;
  const shapes: number[] = [];
  const holesByShape = new Map<number, number[]>();
  rings.forEach((r, i) => {
    if (r.area === 0) return;
    if (r.winding !== 0) shapes.push(i);
    else if (holesByShape.has(r.parent)) holesByShape.get(r.parent)!.push(i);
    else holesByShape.set(r.parent, [i]);
  });

  if (shapes.length <= 1 && (shapes[0] ?? 0) === 0) {
    const tri = earcut(coords, contourStarts.length > 1 ? contourStarts.slice(1) : undefined);
    return {
      vertices: new Float32Array(coords),
      indices: new Uint32Array(tri),
      anchorA: new Uint32Array(anchorA),
      anchorB: new Uint32Array(anchorB),
      anchorT: new Float32Array(anchorT),
    };
  }

  const finalCoords: number[] = [];
  const finalAnchorA: number[] = [];
  const finalAnchorB: number[] = [];
  const finalAnchorT: number[] = [];
  const finalIndices: number[] = [];
  for (const pos of shapes) {
    const holes = holesByShape.get(pos) ?? [];
    const offset = finalCoords.length / 2;
    const groupCoords: number[] = [];
    const groupStarts: number[] = [0];
    for (let i = rings[pos].start; i < rings[pos].end; i++) {
      groupCoords.push(coords[i * 2], coords[i * 2 + 1]);
      finalAnchorA.push(anchorA[i]);
      finalAnchorB.push(anchorB[i]);
      finalAnchorT.push(anchorT[i]);
    }
    for (const h of holes) {
      groupStarts.push(groupCoords.length / 2);
      for (let i = rings[h].start; i < rings[h].end; i++) {
        groupCoords.push(coords[i * 2], coords[i * 2 + 1]);
        finalAnchorA.push(anchorA[i]);
        finalAnchorB.push(anchorB[i]);
        finalAnchorT.push(anchorT[i]);
      }
    }
    const tri = earcut(groupCoords, groupStarts.length > 1 ? groupStarts.slice(1) : undefined);
    for (const v of groupCoords) finalCoords.push(v);
    for (const idx of tri) finalIndices.push(idx + offset);
  }

  return {
    vertices: new Float32Array(finalCoords),
    indices: new Uint32Array(finalIndices),
    anchorA: new Uint32Array(finalAnchorA),
    anchorB: new Uint32Array(finalAnchorB),
    anchorT: new Float32Array(finalAnchorT),
  };
}

function tessellateEvenoddWithAnchors(
  coords: number[],
  contourStarts: number[],
  anchorA: number[],
  anchorB: number[],
  anchorT: number[],
): Mesh {
  const indices: number[] = [];
  const totalVerts = coords.length / 2;
  for (let c = 0; c < contourStarts.length; c++) {
    const start = contourStarts[c];
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : totalVerts;
    for (let i = start + 1; i < end - 1; i++) {
      indices.push(start, i, i + 1);
    }
  }
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
    requiresStencil: true,
    anchorA: new Uint32Array(anchorA),
    anchorB: new Uint32Array(anchorB),
    anchorT: new Float32Array(anchorT),
  };
}
