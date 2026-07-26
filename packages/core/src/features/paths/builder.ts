/**
 * Fluent builder for `PolygonPath`. Hides the `Uint8Array` / `Float32Array`
 * encoding behind move/line/curve/close calls and a final `build()`. Use
 * this to construct paths in tests and demos; production callers that need
 * to mutate large paths in place should reach for the raw arrays directly.
 *
 * Numeric capacity grows by doubling — typical for amortized O(1) push.
 *
 * Also exposes `rectPath` / `polygonFromPoints` shortcuts for the common
 * cases. `rectPath` returns the lighter `RectPath` subtype, not a polygon.
 */

import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type PathFillRule,
  type PolygonPath,
  type RectPath,
} from './types';

/** Fluent builder for `PolygonPath`; hides the `Uint8Array`/`Float32Array` encoding behind move/line/curve/close calls. */
export class PathBuilder {
  private cmds: number[] = [];
  private xs: number[] = [];
  private fillRule: PathFillRule = 'nonzero';

  /** Seed a builder with an existing `PolygonPath`. Useful for extending
   *  an in-flight path with another segment (e.g. appending a cubic to
   *  the end of a curve in response to a user action) without hand-
   *  reaching into the `commands` / `coords` typed arrays.
   *
   *  ```ts
   *  const next = PathBuilder.fromPath(current).curveTo(...).build();
   *  ```
   */
  static fromPath(path: PolygonPath): PathBuilder {
    const b = new PathBuilder();
    b.cmds = Array.from(path.commands);
    b.xs = Array.from(path.coords);
    b.fillRule = path.fillRule;
    return b;
  }

  setFillRule(rule: PathFillRule): this {
    this.fillRule = rule;
    return this;
  }

  moveTo(x: number, y: number): this {
    this.cmds.push(PATH_M);
    this.xs.push(x, y);
    return this;
  }

  lineTo(x: number, y: number): this {
    this.cmds.push(PATH_L);
    this.xs.push(x, y);
    return this;
  }

  /** Cubic bezier to (x, y) with control points (x1, y1) and (x2, y2). */
  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): this {
    this.cmds.push(PATH_C);
    this.xs.push(x1, y1, x2, y2, x, y);
    return this;
  }

  /** Quadratic bezier to (x, y) with control point (x1, y1). */
  quadTo(x1: number, y1: number, x: number, y: number): this {
    this.cmds.push(PATH_Q);
    this.xs.push(x1, y1, x, y);
    return this;
  }

  close(): this {
    this.cmds.push(PATH_Z);
    return this;
  }

  build(): PolygonPath {
    return {
      kind: 'polygon',
      commands: new Uint8Array(this.cmds),
      coords: new Float32Array(this.xs),
      fillRule: this.fillRule,
    };
  }
}

/** Construct a `RectPath` (the fast-path subtype). */
export function rectPath(x: number, y: number, width: number, height: number): RectPath {
  return { kind: 'rect', x, y, width, height };
}

/** Build a closed polygon from a flat list of points. */
export function polygonFromPoints(
  points: readonly { x: number; y: number }[],
  opts: { fillRule?: PathFillRule } = {},
): PolygonPath {
  if (points.length === 0) {
    return {
      kind: 'polygon',
      commands: new Uint8Array(),
      coords: new Float32Array(),
      fillRule: opts.fillRule ?? 'nonzero',
    };
  }
  const b = new PathBuilder();
  if (opts.fillRule) b.setFillRule(opts.fillRule);
  b.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) b.lineTo(points[i].x, points[i].y);
  b.close();
  return b.build();
}

/** Cubic-Bezier kappa for circular-quadrant approximation (<1% max error). */
const ELLIPSE_KAPPA = 0.5522847498307936;

/** Closed ellipse inscribed in `bounds`, as a 4-cubic-Bezier `PolygonPath`.
 *  Matches the geometry `useEllipseTool`'s overlay paints. */
export function ellipsePath(
  bounds: { x: number; y: number; width: number; height: number },
): PolygonPath {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  const ox = rx * ELLIPSE_KAPPA;
  const oy = ry * ELLIPSE_KAPPA;
  const b = new PathBuilder();
  b.moveTo(cx + rx, cy);
  b.curveTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry);
  b.curveTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy);
  b.curveTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry);
  b.curveTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy);
  b.close();
  return b.build();
}

/** Closed regular n-gon centered at `center`, circumscribed by `radius`.
 *  `rotation` is in radians; default 0 puts the first vertex on the +x axis. */
export function regularPolygonPath(
  center: { x: number; y: number },
  radius: number,
  sides: number,
  rotation = 0,
): PolygonPath {
  const b = new PathBuilder();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const x = center.x + radius * Math.cos(a);
    const y = center.y + radius * Math.sin(a);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  }
  b.close();
  return b.build();
}

/** Closed n-pointed star centered at `center`, alternating `outerRadius` and
 *  `innerRadius` (default `outerRadius / 2`). `rotation` is in radians. */
export function starPath(
  center: { x: number; y: number },
  outerRadius: number,
  points = 5,
  innerRadius: number = outerRadius / 2,
  rotation = 0,
): PolygonPath {
  const b = new PathBuilder();
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = rotation + (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = center.x + r * Math.cos(a);
    const y = center.y + r * Math.sin(a);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  }
  b.close();
  return b.build();
}

/** Open 2-vertex polyline from `a` to `b` — strokeable, not fillable. */
export function linePath(
  a: { x: number; y: number },
  b: { x: number; y: number },
): PolygonPath {
  const pb = new PathBuilder();
  pb.moveTo(a.x, a.y);
  pb.lineTo(b.x, b.y);
  return pb.build();
}
