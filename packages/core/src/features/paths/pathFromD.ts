/**
 * `pathFromD` — build a weasel `Path` from an **SVG path-data string** (the
 * value of SVG's `d` attribute, e.g. `"M0 0 L100 0 Z"`).
 *
 * This is the terse, declarative composition surface for geometry: a
 * consumer authors a shape as `d` and hands it straight to a scene/op API,
 * instead of chaining imperative builder calls. SVG `d` is deliberately the
 * language — it's a standard every consumer already knows, so the kit gets
 * path-language expressiveness without minting a new one. See
 * `docs/conventions.md` ("Compose scenes in a terse path language").
 *
 * Lowers every supported command (M/m L/l H/h V/v C/c S/s Q/q T/t A/a Z/z)
 * into weasel's `PathBuilder` primitives (move, line, cubic, quadratic,
 * close). Smooth (`S`/`s`/`T`/`t`) commands resolve their implicit reflected
 * control point from the previous cubic / quadratic. Arc commands (`A`/`a`)
 * convert to a series of cubic Bezier curves using the standard
 * endpoint-parameterization formulas (F.6.5 in the SVG spec): we reconstruct
 * the center, sweep angle, and a fixed number of (≤ 90°) cubic segments per
 * arc.
 *
 * No runtime dependency — a small hand-rolled parser. `@weasel-js/svg`'s
 * document parser (`parseSvg`) calls this for `<path d=…>` elements, so the
 * `d` grammar coverage is shared between the two entry points.
 */

import { PathBuilder } from './builder';

const NUM_RE = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;
/** Same grammar, anchored — used where a number's position matters. */
const NUM_RE_AT = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/y;

/**
 * Is `d[j]` a command letter, as opposed to the `e` of an exponent? `1e2` is
 * a legal coordinate, and treating its `e` as a command drops the number and
 * everything after it in that argument run.
 */
function isCommandLetter(d: string, j: number): boolean {
  const c = d[j];
  if (!/[A-Za-z]/.test(c)) return false;
  if (c !== 'e' && c !== 'E') return true;
  if (!/[\d.]/.test(d[j - 1] ?? '')) return true;
  const k = d[j + 1] === '+' || d[j + 1] === '-' ? j + 2 : j + 1;
  return !/\d/.test(d[k] ?? '');
}

/** Tokenize the command stream from a `d` string. */
function tokenize(d: string): { cmd: string; args: number[] }[] {
  const out: { cmd: string; args: number[] }[] = [];
  // Walk character by character so we can group command-letter + arg-run.
  let i = 0;
  while (i < d.length) {
    if (isCommandLetter(d, i)) {
      // Collect numeric args until the next command letter.
      let j = i + 1;
      while (j < d.length && !isCommandLetter(d, j)) j++;
      const argSlice = d.slice(i + 1, j);
      const cmd = d[i];
      out.push({
        cmd,
        args: cmd === 'A' || cmd === 'a' ? readArcArgs(argSlice) : readNumbers(argSlice),
      });
      i = j;
    } else {
      // Skip any whitespace / commas at the head.
      i++;
    }
  }
  return out;
}

function readNumbers(s: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(s)) !== null) {
    const n = Number(m[0]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Read an `A`/`a` argument run. The two flags are single `0`/`1` digits that
 * need no separator after them, so `a25 25 -30 0 1 50 -25` may legally be
 * written `a25 25 -30 0150 -25` — which a plain number scan reads as two
 * arguments instead of four, leaving the whole arc short and dropped.
 */
function readArcArgs(s: string): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ',' || c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    const slot = out.length % 7;
    if (slot === 3 || slot === 4) {
      if (c !== '0' && c !== '1') return out;
      out.push(c === '1' ? 1 : 0);
      i++;
      continue;
    }
    NUM_RE_AT.lastIndex = i;
    const m = NUM_RE_AT.exec(s);
    if (!m) return out;
    out.push(Number(m[0]));
    i = NUM_RE_AT.lastIndex;
  }
  return out;
}

/**
 * Per-command argument counts (in floats). M/L/T = 2 coords; H/V = 1;
 * C = 6 (two controls + endpoint); S/Q = 4; A = 7 (rx ry x-axis-rotation
 * large-arc-flag sweep-flag x y).
 */
const ARG_COUNTS: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

interface ParseState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  /** Last cubic control point for S/s reflection (in absolute coords). */
  lastCubicCtrl: { x: number; y: number } | null;
  /** Last quadratic control point for T/t reflection (in absolute coords). */
  lastQuadCtrl: { x: number; y: number } | null;
}

/**
 * Build a weasel `PolygonPath` from an SVG path-data (`d`) string. Unknown
 * command letters are skipped (and reported via `onWarn` when provided); the
 * builder still returns whatever valid commands preceded them.
 */
export function pathFromD(
  d: string,
  onWarn?: (message: string) => void,
): ReturnType<PathBuilder['build']> {
  const tokens = tokenize(d);
  const b = new PathBuilder();
  const st: ParseState = {
    x: 0, y: 0, startX: 0, startY: 0,
    lastCubicCtrl: null, lastQuadCtrl: null,
  };

  for (const { cmd, args } of tokens) {
    const upper = cmd.toUpperCase();
    const relative = cmd !== upper;
    const argCount = ARG_COUNTS[upper];
    if (argCount === undefined) {
      onWarn?.(`unknown path command: ${cmd}`);
      continue;
    }
    if (upper === 'Z') {
      b.close();
      st.x = st.startX;
      st.y = st.startY;
      st.lastCubicCtrl = null;
      st.lastQuadCtrl = null;
      continue;
    }
    // M with multiple coord pairs implies subsequent pairs are L (per SVG spec).
    const groups = argCount === 0 ? 1 : Math.floor(args.length / argCount);
    for (let g = 0; g < groups; g++) {
      const a = args.slice(g * argCount, (g + 1) * argCount);
      // For repeated 'M'/'m' coord pairs after the first, downgrade to L/l.
      const effectiveUpper = upper === 'M' && g > 0 ? 'L' : upper;
      runCommand(effectiveUpper, relative, a, st, b);
    }
  }

  return b.build();
}

function runCommand(
  upper: string,
  relative: boolean,
  a: number[],
  st: ParseState,
  b: PathBuilder,
): void {
  const rx = relative ? st.x : 0;
  const ry = relative ? st.y : 0;
  switch (upper) {
    case 'M': {
      const x = a[0] + rx;
      const y = a[1] + ry;
      b.moveTo(x, y);
      st.x = x; st.y = y;
      st.startX = x; st.startY = y;
      st.lastCubicCtrl = null;
      st.lastQuadCtrl = null;
      return;
    }
    case 'L': {
      const x = a[0] + rx;
      const y = a[1] + ry;
      b.lineTo(x, y);
      st.x = x; st.y = y;
      st.lastCubicCtrl = null;
      st.lastQuadCtrl = null;
      return;
    }
    case 'H': {
      const x = a[0] + (relative ? st.x : 0);
      b.lineTo(x, st.y);
      st.x = x;
      st.lastCubicCtrl = null;
      st.lastQuadCtrl = null;
      return;
    }
    case 'V': {
      const y = a[0] + (relative ? st.y : 0);
      b.lineTo(st.x, y);
      st.y = y;
      st.lastCubicCtrl = null;
      st.lastQuadCtrl = null;
      return;
    }
    case 'C': {
      const x1 = a[0] + rx, y1 = a[1] + ry;
      const x2 = a[2] + rx, y2 = a[3] + ry;
      const x = a[4] + rx, y = a[5] + ry;
      b.curveTo(x1, y1, x2, y2, x, y);
      st.x = x; st.y = y;
      st.lastCubicCtrl = { x: x2, y: y2 };
      st.lastQuadCtrl = null;
      return;
    }
    case 'S': {
      // Reflect prior cubic ctrl about the current point; fall back to
      // current point when prior wasn't a cubic.
      const ref = st.lastCubicCtrl ?? { x: st.x, y: st.y };
      const x1 = 2 * st.x - ref.x;
      const y1 = 2 * st.y - ref.y;
      const x2 = a[0] + rx, y2 = a[1] + ry;
      const x = a[2] + rx, y = a[3] + ry;
      b.curveTo(x1, y1, x2, y2, x, y);
      st.x = x; st.y = y;
      st.lastCubicCtrl = { x: x2, y: y2 };
      st.lastQuadCtrl = null;
      return;
    }
    case 'Q': {
      const x1 = a[0] + rx, y1 = a[1] + ry;
      const x = a[2] + rx, y = a[3] + ry;
      b.quadTo(x1, y1, x, y);
      st.x = x; st.y = y;
      st.lastQuadCtrl = { x: x1, y: y1 };
      st.lastCubicCtrl = null;
      return;
    }
    case 'T': {
      const ref = st.lastQuadCtrl ?? { x: st.x, y: st.y };
      const x1 = 2 * st.x - ref.x;
      const y1 = 2 * st.y - ref.y;
      const x = a[0] + rx, y = a[1] + ry;
      b.quadTo(x1, y1, x, y);
      st.x = x; st.y = y;
      st.lastQuadCtrl = { x: x1, y: y1 };
      st.lastCubicCtrl = null;
      return;
    }
    case 'A': {
      const rxA = Math.abs(a[0]);
      const ryA = Math.abs(a[1]);
      const xRot = a[2];
      const largeArc = a[3] !== 0;
      const sweep = a[4] !== 0;
      const ex = a[5] + rx;
      const ey = a[6] + ry;
      arcToCubics(st.x, st.y, ex, ey, rxA, ryA, xRot, largeArc, sweep, b);
      st.x = ex; st.y = ey;
      st.lastCubicCtrl = null;
      st.lastQuadCtrl = null;
      return;
    }
    default:
      return;
  }
}

/**
 * Convert an SVG elliptical arc segment to a series of cubic Bezier
 * `curveTo` calls on the builder. Standard endpoint-parameterization
 * implementation (SVG spec appendix F.6.5):
 *
 *   1. Handle degenerate cases (zero radii → line; same endpoints → noop).
 *   2. Compute the implicit center, start/sweep angles.
 *   3. Split the sweep into ≤ 90° pieces; each piece becomes one cubic.
 */
function arcToCubics(
  x1: number, y1: number,
  x2: number, y2: number,
  rx: number, ry: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  b: PathBuilder,
): void {
  if (x1 === x2 && y1 === y2) return;
  if (rx === 0 || ry === 0) {
    b.lineTo(x2, y2);
    return;
  }
  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: compute (x1', y1') — rotate so x-axis aligns with ellipse axis.
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Correct radii if they're too small.
  let rxs = rx * rx;
  let rys = ry * ry;
  const x1ps = x1p * x1p;
  const y1ps = y1p * y1p;
  const lambda = x1ps / rxs + y1ps / rys;
  let rxFixed = rx;
  let ryFixed = ry;
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rxFixed = sqrtLambda * rx;
    ryFixed = sqrtLambda * ry;
    rxs = rxFixed * rxFixed;
    rys = ryFixed * ryFixed;
  }

  // Step 2: center (cx', cy') in the rotated frame.
  const sign = largeArc === sweep ? -1 : 1;
  const num = rxs * rys - rxs * y1ps - rys * x1ps;
  const den = rxs * y1ps + rys * x1ps;
  const factor = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (factor * (rxFixed * y1p)) / ryFixed;
  const cyp = (factor * -(ryFixed * x1p)) / rxFixed;

  // Step 3: un-rotate the center back to user coords.
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 4: start and sweep angles.
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rxFixed, (y1p - cyp) / ryFixed);
  let dTheta = angle(
    (x1p - cxp) / rxFixed,
    (y1p - cyp) / ryFixed,
    (-x1p - cxp) / rxFixed,
    (-y1p - cyp) / ryFixed,
  );
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // Step 5: split into ≤ 90° segments; emit a cubic per segment.
  const segCount = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const segAngle = dTheta / segCount;
  // Magic constant: cubic bezier handle length to approximate a circular
  // arc — for a segment of half-angle a, t = (4/3) * tan(a/2).
  const t = (4 / 3) * Math.tan(segAngle / 4);

  let prevX = x1;
  let prevY = y1;
  let prevDx = -Math.sin(theta1) * rxFixed;
  let prevDy = Math.cos(theta1) * ryFixed;

  for (let i = 1; i <= segCount; i++) {
    const theta = theta1 + i * segAngle;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const px = cosPhi * (cosT * rxFixed) - sinPhi * (sinT * ryFixed) + cx;
    const py = sinPhi * (cosT * rxFixed) + cosPhi * (sinT * ryFixed) + cy;
    const dxNew = -sinT * rxFixed;
    const dyNew = cosT * ryFixed;
    const c1x = prevX + cosPhi * (t * prevDx) - sinPhi * (t * prevDy);
    const c1y = prevY + sinPhi * (t * prevDx) + cosPhi * (t * prevDy);
    const c2x = px - cosPhi * (t * dxNew) + sinPhi * (t * dyNew);
    const c2y = py - sinPhi * (t * dxNew) - cosPhi * (t * dyNew);
    b.curveTo(c1x, c1y, c2x, c2y, px, py);
    prevX = px;
    prevY = py;
    prevDx = dxNew;
    prevDy = dyNew;
  }
}
