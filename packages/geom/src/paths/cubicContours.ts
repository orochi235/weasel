/**
 * A path as contours of cubic segments: every line and quadratic raised to a
 * cubic, each closing edge written out. The form a computation wants when it
 * treats every segment alike — interpolating two shapes, or carrying one
 * through a warp — and still needs to know which segments were straight.
 */
import { elevateQuadraticToCubic, splitCubicAt } from '../curve';
import { forEachSegment, PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import type { Path, PathFillRule, PolygonPath } from '../path';
import { PathBuilder } from './builder';
import { resolveCorners } from './corners';
import { worldCoords } from './pathOrigin';

/** One cubic segment, `[x0, y0, x1, y1, x2, y2, x3, y3]`, and whether it was
 *  drawn straight. A straight one keeps its controls at its thirds, so it
 *  interpolates and warps as a line would. */
export interface CubicSegment {
  c: [number, number, number, number, number, number, number, number];
  line: boolean;
}

/** One contour of segments, each starting where the one before it ends. */
export interface CubicContour {
  segs: CubicSegment[];
  closed: boolean;
}

/** A straight segment from (ax, ay) to (bx, by), controls at its thirds. */
export function lineSegment(ax: number, ay: number, bx: number, by: number): CubicSegment {
  const dx = (bx - ax) / 3;
  const dy = (by - ay) / 3;
  return { c: [ax, ay, ax + dx, ay + dy, bx - dx, by - dy, bx, by], line: true };
}

/**
 * `path`'s contours as cubic segments. A closed contour whose last point
 * stops short of its first gains the straight closing edge it is drawn with;
 * zero-length straight segments are dropped. A contour with no segments is a
 * lone point and is left out. Corner specs are expanded first.
 */
export function pathToCubicContours(path: Path): CubicContour[] {
  if (path.kind === 'rect') {
    const { x, y, width: w, height: h } = path;
    return [{
      closed: true,
      segs: [
        lineSegment(x, y, x + w, y),
        lineSegment(x + w, y, x + w, y + h),
        lineSegment(x + w, y + h, x, y + h),
        lineSegment(x, y + h, x, y),
      ],
    }];
  }
  const out: CubicContour[] = [];
  let current: CubicContour | null = null;
  let sx = 0;
  let sy = 0;
  const finish = (closed: boolean, px: number, py: number) => {
    if (current === null) return;
    if (closed) {
      if (px !== sx || py !== sy) current.segs.push(lineSegment(px, py, sx, sy));
      current.closed = true;
    }
    if (current.segs.length > 0) out.push(current);
    current = null;
  };
  const drawn = resolveCorners(path);
  const { commands } = drawn;
  const coords = worldCoords(drawn);
  forEachSegment(commands, coords, (cmd, ci, px, py, _i, opens) => {
    if (opens) {
      current = { segs: [], closed: false };
      sx = px;
      sy = py;
    }
    switch (cmd) {
      case PATH_M:
        finish(false, px, py);
        current = { segs: [], closed: false };
        sx = coords[ci]!;
        sy = coords[ci + 1]!;
        break;
      case PATH_L: {
        const x = coords[ci]!;
        const y = coords[ci + 1]!;
        if (x !== px || y !== py) current!.segs.push(lineSegment(px, py, x, y));
        break;
      }
      case PATH_Q: {
        const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(
          px, py, coords[ci]!, coords[ci + 1]!, coords[ci + 2]!, coords[ci + 3]!,
        );
        current!.segs.push({ c: [px, py, c1x, c1y, c2x, c2y, coords[ci + 2]!, coords[ci + 3]!], line: false });
        break;
      }
      case PATH_C:
        current!.segs.push({
          c: [px, py, coords[ci]!, coords[ci + 1]!, coords[ci + 2]!, coords[ci + 3]!, coords[ci + 4]!, coords[ci + 5]!],
          line: false,
        });
        break;
      case PATH_Z:
        finish(true, px, py);
        break;
    }
  });
  const tail = current as CubicContour | null;
  if (tail !== null) {
    const last = tail.segs.at(-1);
    finish(false, last ? last.c[6] : sx, last ? last.c[7] : sy);
  }
  return out;
}

/** The path drawing `contours`: a straight segment as `L`, the rest as `C`. */
export function cubicContoursToPath(contours: readonly CubicContour[], fillRule: PathFillRule = 'nonzero'): PolygonPath {
  const b = new PathBuilder().setFillRule(fillRule);
  for (const { segs, closed } of contours) {
    if (segs.length === 0) continue;
    b.moveTo(segs[0]!.c[0], segs[0]!.c[1]);
    for (const { c, line } of segs) {
      if (line) b.lineTo(c[6], c[7]);
      else b.curveTo(c[2], c[3], c[4], c[5], c[6], c[7]);
    }
    if (closed) b.close();
  }
  return b.build();
}

/** `seg` split in two at parameter `t`. */
export function splitSegment(seg: CubicSegment, t: number): [CubicSegment, CubicSegment] {
  const [l, r] = splitCubicAt(...seg.c, t);
  return [
    { c: [...l] as CubicSegment['c'], line: seg.line },
    { c: [...r] as CubicSegment['c'], line: seg.line },
  ];
}

/** `contour` run the other way: segments in reverse order, each reversed. */
export function reverseContour(contour: CubicContour): CubicContour {
  return {
    closed: contour.closed,
    segs: contour.segs.slice().reverse().map(({ c, line }) => ({
      c: [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]],
      line,
    })),
  };
}
