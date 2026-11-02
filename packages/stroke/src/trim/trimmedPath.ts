import {
  DEFAULT_FLATTEN_TOLERANCE, PATH_L, PATH_M, PATH_Q, PATH_Z, asPolygonPath, cubicEvalAt,
  flattenCubicWithArcLen, flattenQuadraticWithArcLen, forEachSegment, quadraticEvalAt, resolveCorners,
  splitCubicAt, splitQuadraticAt, type Path, type PolygonPath,
} from '@weasel-js/geom';
import type { StrokeTrim } from '@weasel-js/paint';
import { trimSpan } from './trimSpan';

const EPS = 1e-9;
/** Chords per curve when finding where along it a cut falls. */
const SAMPLES = 64;

/** What a trimmed stroke draws, as a path a writer strokes itself. */
export interface TrimmedPath {
  /** One subpath per visible run, in pen order; curves split, not flattened. */
  path: Path;
  /** Per subpath, how far into its pattern a dash starts: `WindowedRun.dashPhase`. */
  dashPhases: number[];
  /** Per subpath, whether it came from a closed one, so it takes no start or end marker. */
  fromClosed: boolean[];
}

/** One drawn segment: its command, the pen then its coords, and its flattened length. */
interface Seg {
  cmd: number;
  c: number[];
  len: number;
}

interface Sub {
  segs: Seg[];
  closed: boolean;
  /** How many of `segs` come before the closing edge drawn out of a `Z`. */
  authored: number;
}

/**
 * The part of `path` that `trim` strokes, cut where the ribbon cuts it: on the
 * corner-resolved path, measured as `trimSpan` measures. A closed subpath the
 * window covers whole stays closed. `null` when the window draws nothing; the
 * input path itself, with no runs listed, when there is no trim.
 */
export function trimmedPath(path: Path, trim: StrokeTrim | undefined): TrimmedPath | null {
  if (trim === undefined) return { path, dashPhases: [], fromClosed: [] };
  const span = trimSpan(path, trim);
  if (!span) return null;
  const resolved = path.kind === 'rect' ? asPolygonPath(path) : resolveCorners(path);
  const out: TrimmedPath = { path, dashPhases: [], fromClosed: [] };
  const commands: number[] = [];
  const coords: number[] = [];
  let at = 0;
  for (const sub of subpathsOf(resolved)) {
    const length = sub.segs.reduce((sum, s) => sum + s.len, 0);
    const lo = Math.max(span.from, at) - at;
    const hi = Math.min(span.to, at + length) - at;
    at += length;
    if (hi - lo <= EPS) continue;
    const whole = sub.closed && lo <= EPS && length - hi <= EPS;
    writeRun(whole ? sub.segs.slice(0, sub.authored) : sub.segs, whole ? 0 : lo, whole ? Infinity : hi, commands, coords);
    if (whole) commands.push(PATH_Z);
    out.dashPhases.push(whole ? 0 : lo);
    out.fromClosed.push(sub.closed);
  }
  if (out.dashPhases.length === 0) return null;
  out.path = {
    kind: 'polygon',
    commands: Uint8Array.from(commands),
    coords: Float32Array.from(coords),
    fillRule: resolved.fillRule,
    ...(resolved.origin ? { origin: resolved.origin } : {}),
  };
  return out;
}

/** `path`'s subpaths as `extractPolylines` reads them, each segment measured as it flattens. */
function subpathsOf(path: PolygonPath): Sub[] {
  const subs: Sub[] = [];
  let cur: Sub | null = null;
  let sx = 0;
  let sy = 0;
  const { commands, coords } = path;
  forEachSegment(commands, coords, (cmd, ci, px, py, _i, opens) => {
    let sub = cur;
    if (cmd === PATH_M || opens || !sub) {
      sub = { segs: [], closed: false, authored: 0 };
      subs.push(sub);
      cur = sub;
      [sx, sy] = cmd === PATH_M ? [coords[ci], coords[ci + 1]] : [px, py];
      if (cmd === PATH_M) return;
    }
    if (cmd === PATH_Z) {
      sub.closed = true;
      sub.authored = sub.segs.length;
      if (px !== sx || py !== sy) sub.segs.push(measured(PATH_L, [px, py, sx, sy]));
      cur = null;
      return;
    }
    const n = cmd === PATH_L ? 2 : cmd === PATH_Q ? 4 : 6;
    sub.segs.push(measured(cmd, [px, py, ...Array.from(coords.subarray(ci, ci + n))]));
  });
  return subs;
}

function measured(cmd: number, c: number[]): Seg {
  const t = DEFAULT_FLATTEN_TOLERANCE;
  const len = cmd === PATH_L ? Math.hypot(c[2] - c[0], c[3] - c[1])
    : cmd === PATH_Q ? flattenQuadraticWithArcLen(c[0], c[1], c[2], c[3], c[4], c[5], t, [], [])
      : flattenCubicWithArcLen(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], t, [], []);
  return { cmd, c, len };
}

/** The stretch of `segs` from `a` to `b` along them, opened with an `M`. */
function writeRun(segs: readonly Seg[], a: number, b: number, commands: number[], coords: number[]): void {
  let s0 = 0;
  let started = false;
  for (const seg of segs) {
    const s1 = s0 + seg.len;
    const from = s0;
    s0 = s1;
    if (s1 <= a + EPS) continue;
    if (from >= b - EPS) break;
    const t0 = from < a ? paramAt(seg, a - from) : 0;
    const t1 = s1 > b ? paramAt(seg, b - from) : 1;
    const piece = subSegment(seg, t0, t1);
    if (!started) {
      commands.push(PATH_M);
      coords.push(piece[0], piece[1]);
      started = true;
    }
    commands.push(seg.cmd);
    for (let i = 2; i < piece.length; i++) coords.push(piece[i]);
  }
}

/** The parameter `d` along `seg` by length: the share of the flattened length, taken on the curve. */
function paramAt(seg: Seg, d: number): number {
  const f = seg.len > 0 ? Math.min(Math.max(d / seg.len, 0), 1) : 0;
  if (seg.cmd === PATH_L || f <= 0 || f >= 1) return f;
  const cum = [0];
  let prev = pointOn(seg, 0);
  for (let i = 1; i <= SAMPLES; i++) {
    const p = pointOn(seg, i / SAMPLES);
    cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const want = f * cum[SAMPLES];
  let i = 1;
  while (i < SAMPLES && cum[i] < want) i++;
  const span = cum[i] - cum[i - 1];
  return (i - 1 + (span > 0 ? (want - cum[i - 1]) / span : 0)) / SAMPLES;
}

function pointOn({ cmd, c }: Seg, t: number): [number, number] {
  return cmd === PATH_Q ? quadraticEvalAt(c[0], c[1], c[2], c[3], c[4], c[5], t)
    : cubicEvalAt(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], t);
}

/** `seg` between parameters `t0` and `t1`, as its pen then its coords. */
function subSegment({ cmd, c }: Seg, t0: number, t1: number): number[] {
  if (cmd === PATH_L) {
    const at = (t: number) => [c[0] + (c[2] - c[0]) * t, c[1] + (c[3] - c[1]) * t];
    return [...at(t0), ...at(t1)];
  }
  const split = (p: number[], t: number): [number[], number[]] => (cmd === PATH_Q
    ? splitQuadraticAt(p[0], p[1], p[2], p[3], p[4], p[5], t)
    : splitCubicAt(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], t));
  const head = t1 >= 1 ? c : split(c, t1)[0];
  return t0 <= 0 ? head : split(head, t1 > 0 ? t0 / t1 : 0)[1];
}
