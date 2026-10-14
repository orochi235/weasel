import { anchorParamsBetween, type Polyline } from '@weasel-js/geom/tessellate';
import { normalizeWidthProfile, widthProfileAt, type WidthProfile } from '@weasel-js/paint';

/** Points a profile adds along a subpath, evenly by arc length, so a straight
 *  run tapers as smoothly as a curved one. */
const PROFILE_SAMPLES = 128;

/** Where a profile's points go along a run, as fractions of its length:
 *  every stop and every even step. */
function profileMarks(stops: WidthProfile): number[] {
  const steps = Array.from({ length: PROFILE_SAMPLES - 1 }, (_, k) => (k + 1) / PROFILE_SAMPLES);
  return [...new Set([...stops.map((s) => s.t), ...steps])].sort((a, b) => a - b);
}

/**
 * Give `pl` the widths `profile` sets: each point's width (its own, or
 * `base` when it has none) times the profile's factor at its fraction of the
 * subpath's arc length. Points are added wherever a stop falls and at even
 * steps between, carrying interpolated anchor parameters and widths. Mutates
 * `pl`.
 */
export function applyWidthProfile(pl: Polyline, profile: WidthProfile, base: number): void {
  const stops = normalizeWidthProfile(profile);
  const n = pl.points.length / 2;
  if (n === 0 || stops.length === 0) return;
  const P = pl.points;
  const A = pl.anchorA ?? new Uint32Array(n);
  const B = pl.anchorB ?? new Uint32Array(n);
  const T = pl.anchorT ?? new Float32Array(n);
  const W = pl.widths;
  const widthAt = (i: number) => (W ? W[i] : base);
  const segCount = pl.closed ? n : n - 1;
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    lens.push(Math.hypot(P[j * 2] - P[i * 2], P[j * 2 + 1] - P[i * 2 + 1]));
    total += lens[i];
  }
  const marks = profileMarks(stops);

  const pts: number[] = [], aA: number[] = [], aB: number[] = [], aT: number[] = [];
  const ws: number[] = [], ts: number[] = [];
  const push = (x: number, y: number, abt: readonly number[], w: number, at: number) => {
    pts.push(x, y); aA.push(abt[0]); aB.push(abt[1]); aT.push(abt[2]); ws.push(w); ts.push(at);
  };
  let walked = 0;
  let m = 0;
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    push(P[i * 2], P[i * 2 + 1], [A[i], B[i], T[i]], widthAt(i), total > 0 ? walked / total : 0);
    const len = lens[i];
    const end = walked + len;
    while (m < marks.length && marks[m] * total <= walked) m++;
    for (; len > 0 && m < marks.length && marks[m] * total < end; m++) {
      const f = (marks[m] * total - walked) / len;
      push(
        P[i * 2] + (P[j * 2] - P[i * 2]) * f, P[i * 2 + 1] + (P[j * 2 + 1] - P[i * 2 + 1]) * f,
        anchorParamsBetween(A[i], B[i], T[i], A[j], B[j], T[j], f),
        widthAt(i) + (widthAt(j) - widthAt(i)) * f, marks[m],
      );
    }
    walked = end;
  }
  if (!pl.closed) push(P[(n - 1) * 2], P[(n - 1) * 2 + 1], [A[n - 1], B[n - 1], T[n - 1]], widthAt(n - 1), 1);

  pl.points = pts;
  pl.anchorA = Uint32Array.from(aA);
  pl.anchorB = Uint32Array.from(aB);
  pl.anchorT = Float32Array.from(aT);
  pl.widths = Float32Array.from(ws, (w, k) => w * widthProfileAt(stops, ts[k], pl.closed));
}
