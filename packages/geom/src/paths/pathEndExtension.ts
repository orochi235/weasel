/**
 * The curve an open end grows along, as the segments `lengthenPathEnd` appends
 * and `extendToMeet` searches. Each mode starts with the end's own point and
 * tangent:
 *
 * - `'tangent'` runs straight on.
 * - `'curvature'` follows the circle of the end's curvature.
 * - `'eased'` starts with the end's curvature and lets it fall linearly to
 *   zero along the arc length (an Euler spiral), then runs straight. The ease
 *   is as long as it takes the spiral to turn `easeTurn`, so a tight end eases
 *   off quickly and a gentle one over a long run. A distance shorter than the
 *   ease stops partway along that same spiral, so every distance walks one
 *   curve, and a drag or a search never reshapes what it has already passed.
 *
 * The spiral is drawn as cubics fitted to it with the spiral's curvature at
 * both ends of each, so the extension meets the path, and its own pieces meet
 * each other, with matching curvature.
 */

import type { Point } from './cubicMath';
import {
  eulerAngleAt, eulerCubicError, eulerCurvatureAt, eulerPointAt, eulerSegmentCubic, integrateEuler,
  type EulerSegment,
} from './eulerSpiral';
import { segmentLength } from './segmentLength';

/** How an end grows: straight on, bending as the end bends, or easing out of
 *  the end's bend into a straight run. */
export type LengthenMode = 'tangent' | 'curvature' | 'eased';

/** Where an end is, which way it heads out of the path, and how it bends there. */
export interface PathEndFrame {
  point: Point;
  /** Unit vector pointing out of the path. */
  tangent: Point;
  /** Signed curvature along `tangent`: positive turns toward `(-tangent.y, tangent.x)`. */
  curvature: number;
}

/** Shape options for the `'eased'` mode. */
export interface EaseOptions {
  /** How far, in radians, the spiral turns before the extension runs
   *  straight. Default π/6 (30°). */
  easeTurn?: number;
}

/** One segment of an extension: a line (two points) or a cubic (four), and
 *  its arc length. */
export interface ExtensionPiece {
  pts: Point[];
  length: number;
}

const DEFAULT_EASE_TURN = Math.PI / 6;
/** Below this turn over the requested length an end grows straight. */
const STRAIGHT_TURN = 1e-6;
const QUARTER = Math.PI / 2;
const FULL = 2 * Math.PI;
/** How far a fitted spiral piece may stray from the spiral: this share of the
 *  ease length, but never under the floor. */
const FIT_SHARE = 1e-4;
const FIT_FLOOR = 1e-3;
const MAX_SPLITS = 6;

/** The pieces of `frame`'s extension in `mode`, `distance` long. Empty when
 *  `distance` is not positive. A curvature arc stops at one full turn. */
export function extensionPieces(
  frame: PathEndFrame, distance: number, mode: LengthenMode, opts: EaseOptions = {},
): ExtensionPiece[] {
  if (!(distance > 0)) return [];
  const bends = Math.abs(frame.curvature) * distance > STRAIGHT_TURN;
  if (mode === 'curvature' && bends) return arcPieces(frame, distance);
  if (mode === 'eased' && bends) return easedPieces(frame, distance, easeTurnOf(opts));
  return [line(frame.point, frame.tangent, distance)];
}

/** The ease length: the arc length over which the eased spiral of `frame`
 *  turns `easeTurn`. Infinite on a straight end. */
export function easeLength(frame: PathEndFrame, opts: EaseOptions = {}): number {
  const k = Math.abs(frame.curvature);
  return k > 0 ? (2 * easeTurnOf(opts)) / k : Infinity;
}

function easeTurnOf(opts: EaseOptions): number {
  const turn = opts.easeTurn;
  return turn !== undefined && Number.isFinite(turn) && turn > 0 ? Math.min(turn, QUARTER) : DEFAULT_EASE_TURN;
}

function line(from: Point, dir: Point, length: number): ExtensionPiece {
  return { pts: [from, { x: from.x + dir.x * length, y: from.y + dir.y * length }], length };
}

function arcCenter({ point, tangent, curvature }: PathEndFrame): Point {
  return { x: point.x - tangent.y / curvature, y: point.y + tangent.x / curvature };
}

/** The circle of curvature at `frame`, one cubic per quarter turn or less. */
function arcPieces(frame: PathEndFrame, distance: number): ExtensionPiece[] {
  const s = Math.sign(frame.curvature);
  const r = 1 / Math.abs(frame.curvature);
  const sweep = Math.min(distance / r, FULL);
  const count = Math.max(1, Math.ceil(sweep / QUARTER - 1e-9));
  const step = sweep / count;
  const reach = (4 / 3) * Math.tan(step / 4) * r;
  const c = arcCenter(frame);
  const rx = frame.point.x - c.x;
  const ry = frame.point.y - c.y;
  const at = (turn: number) => {
    const cos = Math.cos(s * turn);
    const sin = Math.sin(s * turn);
    return {
      p: { x: c.x + rx * cos - ry * sin, y: c.y + rx * sin + ry * cos },
      t: { x: frame.tangent.x * cos - frame.tangent.y * sin, y: frame.tangent.x * sin + frame.tangent.y * cos },
    };
  };
  const out: ExtensionPiece[] = [];
  for (let i = 1; i <= count; i++) {
    const from = at((i - 1) * step);
    const to = at(i * step);
    out.push({
      pts: [
        from.p,
        { x: from.p.x + from.t.x * reach, y: from.p.y + from.t.y * reach },
        { x: to.p.x - to.t.x * reach, y: to.p.y - to.t.y * reach },
        to.p,
      ],
      length: step * r,
    });
  }
  return out;
}

/** The Euler spiral leaving `frame` with its curvature, which falls to zero
 *  over `length` after turning `turn`. */
function easeSpiral(frame: PathEndFrame, length: number, turn: number): EulerSegment {
  const sign = Math.sign(frame.curvature);
  // Normalized curvature runs from 2·turn at the start to 0 at the end.
  const k0 = sign * turn;
  const k1 = -2 * sign * turn;
  // The normalized tangent angle at the start is −¾ of the turn.
  const rotation = Math.atan2(frame.tangent.y, frame.tangent.x) + (3 / 4) * k0;
  const c = integrateEuler(k0, k1);
  const seg: EulerSegment = {
    k0, k1, k2: 0, k3: 0, ratio: Math.hypot(c.x, c.y), chordAngle: Math.atan2(c.y, c.x),
    p0: frame.point, p1: frame.point, length, rotation,
  };
  return { ...seg, p1: eulerPointAt(seg, 1) };
}

function easedPieces(frame: PathEndFrame, distance: number, turn: number): ExtensionPiece[] {
  const ease = (2 * turn) / Math.abs(frame.curvature);
  const spiral = easeSpiral(frame, ease, turn);
  const drawn = distance < ease ? spiralPiece(spiral, 0, distance / ease) : spiral;
  const out = fitSpiral(drawn, Math.max(FIT_FLOOR, FIT_SHARE * ease), 0);
  if (distance > ease) {
    const a = eulerAngleAt(spiral, 1);
    out.push(line(spiral.p1, { x: Math.cos(a), y: Math.sin(a) }, distance - ease));
  }
  return out;
}

/** `seg` as cubics within `tol` of it, halving it where one cubic strays further. */
function fitSpiral(seg: EulerSegment, tol: number, depth: number): ExtensionPiece[] {
  const fitted = g2Cubic(seg) ?? eulerSegmentCubic(seg);
  if (depth < MAX_SPLITS && eulerCubicError(seg, fitted.c1, fitted.c2) > tol) {
    return [...fitSpiral(spiralPiece(seg, 0, 0.5), tol, depth + 1), ...fitSpiral(spiralPiece(seg, 0.5, 1), tol, depth + 1)];
  }
  return [{ pts: [seg.p0, fitted.c1, fitted.c2, seg.p1], length: seg.length }];
}

/** The stretch of the Euler spiral `seg` from fraction `s0` to `s1` of its arc
 *  length. Unlike `subEulerSegment`, which re-places the piece on its chord,
 *  this keeps the piece's length and starting angle exactly the spiral's, so
 *  neighboring pieces meet with no drift in tangent or length. */
function spiralPiece(seg: EulerSegment, s0: number, s1: number): EulerSegment {
  const d = s1 - s0;
  const m = (s0 + s1) / 2 - 0.5;
  const k0 = (seg.k0 + seg.k1 * m) * d;
  const k1 = seg.k1 * d * d;
  const c = integrateEuler(k0, k1);
  return {
    k0, k1, k2: 0, k3: 0, ratio: Math.hypot(c.x, c.y), chordAngle: Math.atan2(c.y, c.x),
    p0: eulerPointAt(seg, s0), p1: eulerPointAt(seg, s1), length: seg.length * d,
    rotation: eulerAngleAt(seg, s0) + k0 / 2 - k1 / 8,
  };
}

const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;

/**
 * The cubic from `seg.p0` to `seg.p1` with the spiral's tangent and curvature
 * at both ends, its handle lengths solved by Newton from the least-squares
 * ones. Null when no such cubic has both handles pointing forward.
 */
function g2Cubic(seg: EulerSegment): { c1: Point; c2: Point } | null {
  const a0 = eulerAngleAt(seg, 0);
  const a1 = eulerAngleAt(seg, 1);
  const u0 = { x: Math.cos(a0), y: Math.sin(a0) };
  const u1 = { x: Math.cos(a1), y: Math.sin(a1) };
  const k0 = eulerCurvatureAt(seg, 0);
  const k1 = eulerCurvatureAt(seg, 1);
  const d = { x: seg.p1.x - seg.p0.x, y: seg.p1.y - seg.p0.y };
  const c = cross(u0, u1);
  const d0 = cross(u0, d);
  const d1 = cross(d, u1);
  const chord = Math.hypot(d.x, d.y);
  if (!(chord > 0) || Math.abs(c) < 1e-9) return null;
  // κ(0) = ⅔·(d0 − b·c)/a² and κ(1) = ⅔·(d1 − a·c)/b² for handle lengths a, b.
  const start = eulerSegmentCubic(seg);
  let a = Math.hypot(start.c1.x - seg.p0.x, start.c1.y - seg.p0.y);
  let b = Math.hypot(start.c2.x - seg.p1.x, start.c2.y - seg.p1.y);
  for (let i = 0; i < 30; i++) {
    const f0 = 1.5 * k0 * a * a - d0 + b * c;
    const f1 = 1.5 * k1 * b * b - d1 + a * c;
    if (Math.abs(f0) + Math.abs(f1) < 1e-12 * chord * chord) break;
    const j00 = 3 * k0 * a, j11 = 3 * k1 * b;
    const det = j00 * j11 - c * c;
    if (Math.abs(det) < 1e-18) return null;
    a -= (f0 * j11 - f1 * c) / det;
    b -= (j00 * f1 - c * f0) / det;
  }
  const f0 = 1.5 * k0 * a * a - d0 + b * c;
  const f1 = 1.5 * k1 * b * b - d1 + a * c;
  if (!(a > 0 && b > 0) || Math.abs(f0) + Math.abs(f1) > 1e-9 * chord * chord) return null;
  return {
    c1: { x: seg.p0.x + a * u0.x, y: seg.p0.y + a * u0.y },
    c2: { x: seg.p1.x - b * u1.x, y: seg.p1.y - b * u1.y },
  };
}

/** The arc length along `piece` at its parameter `t`. */
export function pieceLengthAt(piece: ExtensionPiece, t: number): number {
  if (piece.pts.length === 2) return piece.length * t;
  const whole = segmentLength(piece.pts);
  return whole > 0 ? (piece.length * segmentLength(piece.pts, 0, t)) / whole : 0;
}
