import earcut from 'earcut';
import {
  type Path,
  type PolygonPath,
  type RectPath,
  PATH_M,
  PATH_L,
  PATH_Z,
  PATH_C,
  PATH_Q,
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
} from '@orochi235/weasel';
import type { Mesh } from '../../../renderer/cache/mesh';

export interface TessellateOptions {
  /** Flatness tolerance for bezier subdivision in path-local units. */
  flattenTolerance?: number;
}

export function tessellate(path: Path, opts: TessellateOptions = {}): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  return tessellatePolygon(path, opts);
}

function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  return {
    vertices: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    anchorA: new Uint32Array([0, 1, 2, 3]),
    anchorB: new Uint32Array([0, 1, 2, 3]),
    anchorT: new Float32Array([0, 0, 0, 0]),
  };
}

interface FlattenedContours {
  coords: number[];
  contourStarts: number[];
  anchorA: number[];
  anchorB: number[];
  anchorT: number[];
}

function flattenPolygon(p: PolygonPath, tolerance: number): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const aA: number[] = [];
  const aB: number[] = [];
  const aT: number[] = [];
  const contourStarts: number[] = [];
  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;
  let prevAnchor = -1;
  let anchorCounter = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        contourStarts.push(out.length / 2);
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        aA.push(anchorCounter);
        aB.push(anchorCounter);
        aT.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        aA.push(anchorCounter);
        aB.push(anchorCounter);
        aT.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx], cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2], ey = coords[coordIdx + 3];
        const target = anchorCounter;
        const arcAccum: number[] = [];
        const startIdx = out.length / 2;
        const total = flattenQuadraticWithArcLen(prevX, prevY, cx, cy, ex, ey, tolerance, out, arcAccum);
        for (let k = 0; k < arcAccum.length; k++) {
          aA.push(prevAnchor);
          aB.push(target);
          aT.push(total > 0 ? arcAccum[k] / total : 0);
        }
        // Pin the last point (anchor-exact).
        const lastIdx = startIdx + arcAccum.length - 1;
        aA[lastIdx] = target;
        aB[lastIdx] = target;
        aT[lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = target;
        anchorCounter++;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx], c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2], c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4], ey = coords[coordIdx + 5];
        const target = anchorCounter;
        const arcAccum: number[] = [];
        const startIdx = out.length / 2;
        const total = flattenCubicWithArcLen(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, out, arcAccum);
        for (let k = 0; k < arcAccum.length; k++) {
          aA.push(prevAnchor);
          aB.push(target);
          aT.push(total > 0 ? arcAccum[k] / total : 0);
        }
        const lastIdx = startIdx + arcAccum.length - 1;
        aA[lastIdx] = target;
        aB[lastIdx] = target;
        aT[lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = target;
        anchorCounter++;
        coordIdx += 6;
        break;
      }
      case PATH_Z: {
        break;
      }
      default:
        throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  }

  return { coords: out, contourStarts, anchorA: aA, anchorB: aB, anchorT: aT };
}

function tessellatePolygon(p: PolygonPath, opts: TessellateOptions): Mesh {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { coords, contourStarts, anchorA, anchorB, anchorT } = flattenPolygon(p, tolerance);

  if (p.fillRule === 'evenodd') {
    return tessellateEvenoddWithAnchors(coords, contourStarts, anchorA, anchorB, anchorT);
  }

  const totalVerts = coords.length / 2;
  const contourEnd = (i: number): number =>
    i + 1 < contourStarts.length ? contourStarts[i + 1] : totalVerts;

  if (contourStarts.length <= 1) {
    const tri = earcut(coords);
    return {
      vertices: new Float32Array(coords),
      indices: new Uint32Array(tri),
      anchorA: new Uint32Array(anchorA),
      anchorB: new Uint32Array(anchorB),
      anchorT: new Float32Array(anchorT),
    };
  }

  const areas: number[] = contourStarts.map((s, i) => signedArea(coords, s, contourEnd(i)));
  const refSign = Math.sign(areas[0]) || 1;

  const positives: number[] = [];
  const negatives: number[] = [];
  for (let i = 0; i < contourStarts.length; i++) {
    if (areas[i] === 0) continue;
    if (Math.sign(areas[i]) === refSign) positives.push(i);
    else negatives.push(i);
  }

  if (positives.length === 1 && negatives.length > 0) {
    const holeIndices = contourStarts.slice(1);
    const tri = earcut(coords, holeIndices);
    return {
      vertices: new Float32Array(coords),
      indices: new Uint32Array(tri),
      anchorA: new Uint32Array(anchorA),
      anchorB: new Uint32Array(anchorB),
      anchorT: new Float32Array(anchorT),
    };
  }

  const holesByPositive = new Map<number, number[]>();
  const orphanPositives: number[] = [];
  for (const n of negatives) {
    const px = coords[contourStarts[n] * 2];
    const py = coords[contourStarts[n] * 2 + 1];
    let bestPos = -1;
    let bestAbsArea = Infinity;
    for (const pos of positives) {
      const absArea = Math.abs(areas[pos]);
      if (absArea < bestAbsArea && pointInContour(coords, contourStarts[pos], contourEnd(pos), px, py)) {
        bestAbsArea = absArea;
        bestPos = pos;
      }
    }
    if (bestPos >= 0) {
      const arr = holesByPositive.get(bestPos) ?? [];
      arr.push(n);
      holesByPositive.set(bestPos, arr);
    } else {
      orphanPositives.push(n);
    }
  }

  const allPositives = [...positives, ...orphanPositives];

  const finalCoords: number[] = [];
  const finalAnchorA: number[] = [];
  const finalAnchorB: number[] = [];
  const finalAnchorT: number[] = [];
  const finalIndices: number[] = [];
  for (const pos of allPositives) {
    const holes = holesByPositive.get(pos) ?? [];
    const offset = finalCoords.length / 2;
    const groupCoords: number[] = [];
    const groupStarts: number[] = [0];
    for (let i = contourStarts[pos]; i < contourEnd(pos); i++) {
      groupCoords.push(coords[i * 2], coords[i * 2 + 1]);
      finalAnchorA.push(anchorA[i]);
      finalAnchorB.push(anchorB[i]);
      finalAnchorT.push(anchorT[i]);
    }
    for (const h of holes) {
      groupStarts.push(groupCoords.length / 2);
      for (let i = contourStarts[h]; i < contourEnd(h); i++) {
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

function signedArea(coords: number[], start: number, end: number): number {
  let a = 0;
  for (let i = start; i < end; i++) {
    const j = i + 1 === end ? start : i + 1;
    a += coords[i * 2] * coords[j * 2 + 1] - coords[j * 2] * coords[i * 2 + 1];
  }
  return a * 0.5;
}

function pointInContour(coords: number[], start: number, end: number, x: number, y: number): boolean {
  let inside = false;
  for (let i = start, j = end - 1; i < end; j = i++) {
    const xi = coords[i * 2], yi = coords[i * 2 + 1];
    const xj = coords[j * 2], yj = coords[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}


