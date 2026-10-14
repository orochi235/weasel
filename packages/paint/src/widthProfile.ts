/**
 * A stroke's width along its length: stops of `{ t, width }`, read by a
 * smooth curve through them.
 */

/** One stop of a {@link WidthProfile}. */
export interface WidthStop {
  /** Where the stop sits, as a fraction 0..1 of its subpath's arc length. */
  readonly t: number;
  /** The stroke's width there, as a multiple of `Stroke.width`. */
  readonly width: number;
}

/**
 * Stops sorted by `t`. Between two stops the width follows a monotone cubic,
 * which passes through every stop and never swings past its neighbors, so a
 * profile of positive widths stays positive. Before the first stop and after
 * the last the width holds, except on a closed subpath, where the curve runs
 * on across the seam to the stop on the other side.
 */
export type WidthProfile = readonly WidthStop[];

/** `profile` sorted by `t`, each `t` clamped to 0..1 and each width to 0 or
 *  more, without stops whose numbers are not finite. Of two stops at one
 *  `t`, the later one in `profile` is kept. */
export function normalizeWidthProfile(profile: readonly WidthStop[]): WidthStop[] {
  const byT = new Map<number, WidthStop>();
  for (const s of profile) {
    if (!Number.isFinite(s.t) || !Number.isFinite(s.width)) continue;
    const t = Math.min(1, Math.max(0, s.t));
    byT.set(t, { t, width: Math.max(0, s.width) });
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

/** The width factor `profile` gives at `t`; 1 when it has no stops. */
export function widthProfileAt(profile: WidthProfile, t: number, closed = false): number {
  const n = profile.length;
  if (n === 0) return 1;
  if (n === 1) return profile[0].width;
  // Two stops carried across each side of the seam give the spans that
  // cross it interior tangents.
  const stops = closed
    ? [...profile.slice(-2).map((s) => shifted(s, -1)), ...profile, ...profile.slice(0, 2).map((s) => shifted(s, 1))]
    : profile;
  return monotoneCubicAt(stops, t);
}

/** The largest factor `profile` reaches: the widest stop, since the curve
 *  never passes one. 1 for no profile. */
export function widestInProfile(profile: WidthProfile | undefined): number {
  if (!profile || profile.length === 0) return 1;
  let widest = 0;
  for (const s of profile) if (s.width > widest) widest = s.width;
  return widest;
}

/** `profile` with a stop of `width` at `t`: the stop within `near` of `t`
 *  moves there, or a new one is added. */
export function setWidthStop(profile: WidthProfile, t: number, width: number, near = 0): WidthStop[] {
  let hit = -1;
  let best = near;
  profile.forEach((s, i) => {
    const d = Math.abs(s.t - t);
    if (d <= best) { best = d; hit = i; }
  });
  const rest = hit < 0 ? profile : profile.filter((_, i) => i !== hit);
  return normalizeWidthProfile([...rest, { t, width }]);
}

/** `profile` without its stop at `index`. */
export function removeWidthStop(profile: WidthProfile, index: number): WidthStop[] {
  return profile.filter((_, i) => i !== index);
}

function shifted(s: WidthStop, by: number): WidthStop {
  return { t: s.t + by, width: s.width };
}

/** Fritsch–Carlson monotone cubic Hermite through `stops`, held flat past
 *  the ends. An end stop inside 0..1 takes a level tangent, so the hold
 *  meets the curve without a kink. */
function monotoneCubicAt(stops: WidthProfile, t: number): number {
  const n = stops.length;
  if (t <= stops[0].t) return stops[0].width;
  if (t >= stops[n - 1].t) return stops[n - 1].width;
  const slopes: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    slopes.push((stops[k + 1].width - stops[k].width) / (stops[k + 1].t - stops[k].t));
  }
  const tangent = (k: number): number => {
    if (k === 0) return stops[0].t > 0 ? 0 : slopes[0];
    if (k === n - 1) return stops[n - 1].t < 1 ? 0 : slopes[n - 2];
    const a = slopes[k - 1], b = slopes[k];
    if (a * b <= 0) return 0;
    // The harmonic mean keeps the curve inside its neighbors' range.
    return (2 * a * b) / (a + b);
  };
  let k = 0;
  while (t > stops[k + 1].t) k++;
  const h = stops[k + 1].t - stops[k].t;
  const s = (t - stops[k].t) / h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * stops[k].width
    + (s3 - 2 * s2 + s) * h * tangent(k)
    + (-2 * s3 + 3 * s2) * stops[k + 1].width
    + (s3 - s2) * h * tangent(k + 1);
}
