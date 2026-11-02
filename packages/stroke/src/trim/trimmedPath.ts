import {
  PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, asPolygonPath, curveSpan, lengthAtCurve, pathLengthTable, runSegments,
  splitCubicAt, splitQuadraticAt, type CurvePosition, type LengthTable, type Path,
} from '@weasel-js/geom';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from './resolveTrim';

const EPS = 1e-9;

/** What a trimmed stroke draws, as a path a writer strokes itself. */
export interface TrimmedPath {
  /** One subpath per visible run, in pen order; curves split, not flattened. */
  path: Path;
  /** Per subpath, how far into its pattern a dash starts: the exact arc length from
   *  its subpath's start to the cut, the measure a writer's own dashes run in. */
  dashPhases: number[];
  /** Per subpath, whether it came from a closed one, so it takes no start or end marker. */
  fromClosed: boolean[];
}

/**
 * The part of `path` that `trim` strokes, cut on the curve points the ribbon
 * cuts at: on the corner-resolved path, at the positions `trimSpan` resolves.
 * A closed subpath the window covers whole stays closed. `null` when the
 * window draws nothing; the input path itself, with no runs listed, when there
 * is no trim.
 */
export function trimmedPath(path: Path, trim: StrokeTrim | undefined): TrimmedPath | null {
  if (trim === undefined) return { path, dashPhases: [], fromClosed: [] };
  const table = pathLengthTable(path);
  const lengths = resolveTrim(table, trim);
  const span = lengths && curveSpan(table, lengths);
  if (!span) return null;
  const out: TrimmedPath = { path, dashPhases: [], fromClosed: [] };
  const commands: number[] = [];
  const coords: number[] = [];
  for (let r = span.from.run; r <= span.to.run; r++) {
    const segs = runSegments(table, r);
    const lo: CurvePosition = r === span.from.run ? span.from : { run: r, segment: 0, t: 0 };
    const hi: CurvePosition = r === span.to.run ? span.to : { run: r, segment: segs - 1, t: 1 };
    const at = table.runStart[r];
    const head = lengthAtCurve(table, lo) - at;
    if (segs <= 0 || lengthAtCurve(table, hi) - at - head <= EPS) continue;
    const { closed } = table.runs[r];
    const whole = closed && head <= EPS && table.runStart[r + 1] - lengthAtCurve(table, hi) <= EPS;
    writeRun(table, r, lo, hi, whole, commands, coords);
    out.dashPhases.push(whole ? 0 : head);
    out.fromClosed.push(closed);
  }
  if (out.dashPhases.length === 0) return null;
  const shape = path.kind === 'rect' ? asPolygonPath(path) : path;
  out.path = {
    kind: 'polygon',
    commands: Uint8Array.from(commands),
    coords: Float32Array.from(coords),
    fillRule: shape.fillRule,
    ...(shape.origin ? { origin: shape.origin } : {}),
  };
  return out;
}

/** Run `r` of `table` from `lo` to `hi`, opened with an `M`; `whole` closes it with a `Z` instead
 *  of writing a straight closing edge. */
function writeRun(
  table: LengthTable, r: number, lo: CurvePosition, hi: CurvePosition, whole: boolean,
  commands: number[], coords: number[],
): void {
  const { points, controls } = table.runs[r];
  const n = points.length / 2;
  for (let k = lo.segment; k <= hi.segment; k++) {
    const ctl = controls?.[k];
    const cmd = !ctl || ctl.length === 0 ? PATH_L : ctl.length === 2 ? PATH_Q : PATH_C;
    if (whole && cmd === PATH_L && k === n - 1) break;
    const j = (k + 1) % n;
    const seg = [points[k * 2], points[k * 2 + 1], ...(ctl ? Array.from(ctl) : []), points[j * 2], points[j * 2 + 1]];
    const piece = subSegment(cmd, seg, k === lo.segment ? lo.t : 0, k === hi.segment ? hi.t : 1);
    if (k === lo.segment) {
      commands.push(PATH_M);
      coords.push(piece[0], piece[1]);
    }
    commands.push(cmd);
    for (let i = 2; i < piece.length; i++) coords.push(piece[i]);
  }
  if (whole) commands.push(PATH_Z);
}

/** Segment `c`, drawn by `cmd`, between parameters `t0` and `t1`, as its pen then its coords. */
function subSegment(cmd: number, c: number[], t0: number, t1: number): number[] {
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
