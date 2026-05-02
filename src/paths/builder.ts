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

export class PathBuilder {
  private cmds: number[] = [];
  private xs: number[] = [];
  private fillRule: PathFillRule = 'nonzero';

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
