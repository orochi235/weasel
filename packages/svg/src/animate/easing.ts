import { isBlitsEasing, resolveKeyEasing, type KeyEasing } from '@weasel-js/animator';
import { easingBezier, easingDataOf } from '@weasel-js/geom';

type Jump = 'start' | 'end' | 'none' | 'both';
type Point = { t: number; v: number };
type Steps = { steps: number; jump?: Jump };

const SAMPLES = 24;

/** A number with at most 4 decimals and no trailing zeros. */
export function numText(n: number): string {
  return String(Number(n.toFixed(4)) + 0);
}

/** A number with at most 4 decimals, as a number. */
export function rounded(n: number): number {
  return Number(numText(n));
}

const bezierOf = (easing: KeyEasing | undefined) => (isBlitsEasing(easing) ? null : easingBezier(easing));

/** Steps of at least one; zero steps never move, which reads as linear. */
function stepsOf(easing: KeyEasing | undefined): Steps | null {
  return isBlitsEasing(easing) && 'steps' in easing && easing.steps >= 1 ? easing : null;
}

function isLinear(easing: KeyEasing | undefined): boolean {
  return easing === undefined || easing === 'linear' || (isBlitsEasing(easing) && 'steps' in easing && !stepsOf(easing));
}

/** Whether `easing` holds its value to the key and then jumps, as SMIL's discrete and a Lottie hold do. */
function isHold(easing: KeyEasing | undefined): boolean {
  const steps = stepsOf(easing);
  return steps !== null && steps.steps === 1 && (steps.jump ?? 'end') === 'end';
}

function sampled(easing: KeyEasing | undefined): number[] {
  const fn = resolveKeyEasing(easing);
  return Array.from({ length: SAMPLES + 1 }, (_, i) => fn(i / SAMPLES));
}

/** The value held through step `k` of `n`. */
function stepValue(k: number, n: number, jump: Jump): number {
  if (jump === 'start') return (k + 1) / n;
  if (jump === 'none') return n > 1 ? k / (n - 1) : 1;
  if (jump === 'both') return (k + 1) / (n + 1);
  return k / n;
}

function staircase({ steps: n, jump = 'end' }: Steps): Point[] {
  const out: Point[] = [{ t: 0, v: 0 }];
  for (let k = 0; k < n; k++) {
    const v = stepValue(k, n, jump);
    out.push({ t: k / n, v }, { t: (k + 1) / n, v });
  }
  out.push({ t: 1, v: 1 });
  return out.filter((p, i) => i === 0 || p.t !== out[i - 1].t || p.v !== out[i - 1].v);
}

/** The breakpoints of blits `linear` points, placed as CSS `linear()` places them. */
export function breakpointsOf(points: readonly (number | readonly number[])[]): Point[] {
  const out: { v: number; t?: number }[] = [];
  for (const p of points) {
    if (typeof p === 'number') out.push({ v: p });
    else if (p[2] === undefined) out.push({ v: p[0], t: p[1] });
    else out.push({ v: p[0], t: p[1] }, { v: p[0], t: p[2] });
  }
  if (out.length === 0) return [{ t: 0, v: 0 }, { t: 1, v: 1 }];
  out[0].t ??= 0;
  out[out.length - 1].t ??= 1;
  let prev = -Infinity;
  for (const p of out) if (p.t !== undefined) prev = p.t = Math.max(p.t, prev);
  let from = 0;
  for (let i = 1; i < out.length; i++) {
    if (out[i].t === undefined) continue;
    for (let k = from + 1; k < i; k++) {
      out[k].t = out[from].t! + ((out[i].t! - out[from].t!) * (k - from)) / (i - from);
    }
    from = i;
  }
  return out.map((p) => ({ t: p.t!, v: p.v }));
}

/** A named curve as the bezier or `linear()` points blits stores it as, so it writes out as data, not samples. */
function dataOf(easing: KeyEasing | undefined): KeyEasing | undefined {
  return typeof easing === 'string' && easing !== 'linear' ? easingDataOf(easing) : easing;
}

/** Points a writer inserts where its format has no form for the easing. */
function expandedOf(easing: KeyEasing | undefined): Point[] {
  const steps = stepsOf(easing);
  if (steps) return staircase(steps);
  if (isBlitsEasing(easing) && 'linear' in easing) return breakpointsOf(easing.linear);
  return sampled(easing).map((v, i) => ({ t: i / SAMPLES, v }));
}

function cssLinearPoint(p: number | readonly number[]): string {
  if (typeof p === 'number') return numText(p);
  const [out, from, to] = p;
  const at = (x: number) => `${numText(x * 100)}%`;
  return [numText(out), from === undefined ? '' : at(from), to === undefined ? '' : at(to)].filter(Boolean).join(' ');
}

/** The CSS `animation-timing-function` for an easing. */
export function cssTimingOf(named: KeyEasing | undefined): string {
  const easing = dataOf(named);
  if (isLinear(easing)) return 'linear';
  const bezier = bezierOf(easing);
  if (bezier) return `cubic-bezier(${bezier.map(numText).join(', ')})`;
  const steps = stepsOf(easing);
  // One step with no jump at either end is invalid CSS; it holds the end throughout, as jump-start does.
  if (steps) return `steps(${steps.steps}, jump-${steps.steps === 1 && steps.jump === 'none' ? 'start' : steps.jump ?? 'end'})`;
  if (isBlitsEasing(easing) && 'linear' in easing) return `linear(${easing.linear.map(cssLinearPoint).join(', ')})`;
  return `linear(${sampled(easing).map(numText).join(', ')})`;
}

/** How a SMIL `animate` eases into a key, or the points to insert where it has no form for it. */
export function smilTimingOf(named: KeyEasing | undefined): {
  calcMode: 'linear' | 'spline' | 'discrete';
  keySpline?: string;
  expand?: Point[];
} {
  const easing = dataOf(named);
  if (isLinear(easing)) return { calcMode: 'linear' };
  const bezier = bezierOf(easing);
  if (bezier) return { calcMode: 'spline', keySpline: bezier.map(numText).join(' ') };
  if (isHold(easing)) return { calcMode: 'discrete' };
  return { calcMode: 'linear', expand: expandedOf(easing) };
}

/** A Lottie keyframe's outgoing and incoming tangents, a hold, or the points to insert. */
export function lottieTangentsOf(named: KeyEasing | undefined):
  | { o: { x: number; y: number }; i: { x: number; y: number } }
  | { hold: true }
  | { expand: Point[] } {
  const easing = dataOf(named);
  if (isLinear(easing)) return { o: { x: 0, y: 0 }, i: { x: 1, y: 1 } };
  const bezier = bezierOf(easing);
  if (bezier) return { o: { x: bezier[0], y: bezier[1] }, i: { x: bezier[2], y: bezier[3] } };
  if (isHold(easing)) return { hold: true };
  return { expand: expandedOf(easing) };
}
