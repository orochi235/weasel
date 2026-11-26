/**
 * A clip written as an SVG animated by SMIL: one `<animate>` per node and attribute, inside the
 * node's element. The inverse of the SMIL import, naming tracks as it does.
 */
import type { Clip, ClipKey } from '@weasel-js/animator';
import { lerp } from '@weasel-js/geom';
import { escapeAttr } from '@weasel-js/registry';
import type { SerializeOptions } from '../serializeOptions';
import type { SvgNode } from '../types';
import { numText, smilTimingOf } from './easing';
import { serializeAnimated, valueText, type ClipPlan, type Frame, type PlannedTrack, type Warn } from './plan';

/** How the span into a frame moves: `hold` where nothing moves, so any calcMode carries it. */
type Mode = 'linear' | 'spline' | 'discrete' | 'hold';
interface Span { mode: Mode; keySpline?: string }
interface Point { frame: Frame; into: Span }

const LINEAR_SPLINE = '0 0 1 1';

/** `a` to `b` at `k`, or null where the values do not lerp. */
function lerpOf(a: ClipKey['value'], b: ClipKey['value'], k: number): ClipKey['value'] | null {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, k);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v) => typeof v === 'number')) {
    return (a as number[]).map((v, i) => lerp(v, b[i] as number, k));
  }
  return null;
}

/** A frame inserted at `t`, holding a lerp of two values already written, which always has text. */
function frameAt(prop: string, t: number, value: ClipKey['value']): Frame {
  return { t, value, text: valueText(prop, value)!, easing: undefined };
}

/**
 * The points one span from `from` to `to` lowers to, `to` last: the inserted points of an easing
 * SMIL has no form for, linear between them, held from 0 and to 1 where they start or end inside.
 */
function spanPoints(prop: string, from: Frame, to: Frame): Point[] {
  if (from.text === to.text || from.t === to.t) return [{ frame: to, into: { mode: 'hold' } }];
  const timing = smilTimingOf(to.easing);
  if (!timing.expand) return [{ frame: to, into: { mode: timing.calcMode, keySpline: timing.keySpline } }];
  const span = to.t - from.t;
  const inserted: Point[] = [];
  const pts = timing.expand;
  const held = [...(pts[0].t > 0 ? [{ t: 0, v: pts[0].v }] : []), ...pts, ...(pts[pts.length - 1].t < 1 ? [{ t: 1, v: pts[pts.length - 1].v }] : [])];
  for (const p of held) {
    const value = lerpOf(from.value, to.value, p.v);
    if (value === null) return [{ frame: to, into: { mode: 'linear' } }];
    inserted.push({ frame: frameAt(prop, from.t + p.t * span, value), into: { mode: 'linear' } });
  }
  return [...inserted, { frame: to, into: { mode: 'linear' } }];
}

/** A track's points, a discrete span among others written as a hold and a jump, and its calcMode. */
function pointsOf(prop: string, frames: readonly Frame[]): { points: Point[]; mode: Exclude<Mode, 'hold'> } {
  let points: Point[] = [{ frame: frames[0], into: { mode: 'hold' } }];
  for (let i = 1; i < frames.length; i++) points.push(...spanPoints(prop, frames[i - 1], frames[i]));
  points = points.filter((p, i) => i === 0 || p.frame.t !== points[i - 1].frame.t || p.frame.text !== points[i - 1].frame.text);
  const modes = new Set(points.map((p) => p.into.mode).filter((m) => m !== 'hold'));
  if (modes.has('discrete') && modes.size > 1) {
    points = points.flatMap((p, i) => (p.into.mode === 'discrete'
      ? [{ frame: { ...points[i - 1].frame, t: p.frame.t }, into: { mode: 'hold' } }, { frame: p.frame, into: { mode: 'hold' } }]
      : [p]));
    modes.delete('discrete');
  }
  const mode = modes.has('discrete') ? 'discrete' : modes.has('spline') ? 'spline' : 'linear';
  return { points, mode };
}

/** One track as an `<animate>`, or a `<set>` where it never moves. */
function animateOf({ prop, still, frames }: PlannedTrack, duration: number, timing: string): string {
  if (still !== undefined) return `<set attributeName="${escapeAttr(prop)}" to="${escapeAttr(still)}"${timing}/>`;
  const { points, mode } = pointsOf(prop, frames);
  const attrs: [string, string][] = [['attributeName', prop]];
  if (mode !== 'linear') attrs.push(['calcMode', mode]);
  attrs.push(['values', points.map((p) => p.frame.text).join(';')], ['keyTimes', points.map((p) => numText(p.frame.t / duration)).join(';')]);
  if (mode === 'spline') attrs.push(['keySplines', points.slice(1).map((p) => p.into.keySpline ?? LINEAR_SPLINE).join(';')]);
  return `<animate ${attrs.map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')}${timing}/>`;
}

/** Each node's animation elements for `plan`. */
function animationsOf({ duration, passes, tracks }: ClipPlan, warn: Warn): Map<string, string> {
  const timing = duration > 0
    ? ` dur="${numText(duration)}ms" repeatCount="${passes === Infinity ? 'indefinite' : numText(passes)}" fill="freeze"`
    : ' fill="freeze"';
  const out = new Map<string, string>();
  for (const track of tracks) {
    if ([track.still, ...track.frames.map((f) => f.text)].some((text) => text?.includes(';'))) {
      warn(`#${track.id}.${track.prop} holds a value with a ";", which a SMIL values list cannot; it is skipped`);
      continue;
    }
    out.set(track.id, (out.get(track.id) ?? '') + animateOf(track, duration, timing));
  }
  return out;
}

/**
 * `nodes` as an SVG document animated by `clip` in SMIL. Each sampled track `<id>.<attribute>`
 * becomes an `<animate>` inside the node with that id, for the clip's duration (else to its last
 * key), as often as its `loop` says, frozen at its end; a track that never moves is a `<set>`.
 * Trim tracks are drawn as a dash on `pathLength="1"` (see `dashTracksOf`). A track this cannot
 * write, or whose id no node has, is skipped with a warning through `opts.onWarn`; `opts.decorate`
 * is kept and added to.
 */
export function serializeSmilAnimatedSvg(nodes: SvgNode[], clip: Clip, opts: SerializeOptions = {}): string {
  return serializeAnimated(nodes, clip, opts, 'SMIL', (plan, warn) => {
    const animations = animationsOf(plan, warn);
    return { childrenOf: (id) => animations.get(id) };
  });
}
