/**
 * An element's CSS animations as the cascade gives them: the `animation` shorthand and its
 * longhands, each a comma list, read into one record per animation. A longhand overrides the
 * shorthand's value for it, since the cascade keeps no order between the two.
 */
import type { ClipKey } from '@weasel-js/animator';
import { breakpointsOf } from './animate/easing';
import { declaredOf } from './cascade';

type Bezier = [number, number, number, number];
/** What eases into a key: a bezier or steps, as a clip writes it; undefined is linear. */
export type CssEasing = Exclude<ClipKey['easing'], string>;
type LinearPoint = Extract<CssEasing, { linear: unknown }>['linear'][number];

export type CssDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
export type CssFillMode = 'none' | 'forwards' | 'backwards' | 'both';

/** One animation of one element. Times are ms. */
export interface CssAnimation {
  name: string;
  duration: number;
  delay: number;
  easing: CssEasing | undefined;
  iterations: number;
  direction: CssDirection;
  fill: CssFillMode;
}

const NAMED: Readonly<Record<string, Bezier | 'linear'>> = {
  linear: 'linear', ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1],
};
const DIRECTIONS = new Set<string>(['normal', 'reverse', 'alternate', 'alternate-reverse']);
const FILLS = new Set<string>(['none', 'forwards', 'backwards', 'both']);
const TOKEN = /[\w-]+\([^)]*\)|[^\s,]+/g;

/** A CSS `<time>` in ms, or null for none. */
export function cssTime(raw: string): number | null {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(ms|s)$/i.exec(raw.trim());
  return m ? Number(m[1]) * (m[2].toLowerCase() === 's' ? 1000 : 1) : null;
}

/** A CSS `<easing-function>` as a clip key's easing: null where it is none, undefined for linear. */
export function cssEasing(raw: string): CssEasing | undefined | null {
  const s = raw.trim().toLowerCase();
  if (Object.hasOwn(NAMED, s)) {
    const named = NAMED[s];
    return named === 'linear' ? undefined : { bezier: named };
  }
  if (s === 'step-start') return { steps: 1, jump: 'start' };
  if (s === 'step-end') return { steps: 1, jump: 'end' };
  const fn = /^([\w-]+)\(([^)]*)\)$/.exec(s);
  if (!fn) return null;
  const args = fn[2].split(',').map((a) => a.trim());
  if (fn[1] === 'cubic-bezier') {
    const b = args.map(Number);
    return b.length === 4 && b.every(Number.isFinite) ? { bezier: b as Bezier } : null;
  }
  if (fn[1] === 'steps') {
    const n = Number(args[0]);
    const pos = args[1] ?? 'end';
    if (!(Number.isInteger(n) && n > 0)) return null;
    if (pos === 'start' || pos === 'jump-start') return { steps: n, jump: 'start' };
    if (pos === 'end' || pos === 'jump-end') return { steps: n, jump: 'end' };
    if (pos === 'jump-both') return { steps: n, jump: 'both' };
    if (pos === 'jump-none') return n > 1 ? { steps: n, jump: 'none' } : null;
    return null;
  }
  if (fn[1] === 'linear') {
    const points = args.map(linearPoint);
    return points.length >= 2 && points.every((p) => p !== null) ? { linear: points as LinearPoint[] } : null;
  }
  return null;
}

/** One `linear()` stop: an output, then up to two percentages in either order around it. */
function linearPoint(raw: string): LinearPoint | null {
  let out: number | undefined;
  const at: number[] = [];
  for (const part of raw.split(/\s+/)) {
    const pct = /^([+-]?(?:\d+\.?\d*|\.\d+))%$/.exec(part);
    if (pct) at.push(Number(pct[1]) / 100);
    else if (out === undefined && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(part)) out = Number(part);
    else return null;
  }
  if (out === undefined || at.length > 2) return null;
  return at.length === 0 ? out : at.length === 1 ? [out, at[0]] : [out, at[0], at[1]];
}

/** A shorthand item's parts, as `animation` lets them come in any order: the first time is the duration, the second the delay. */
function readShorthand(item: string): Partial<CssAnimation> {
  const out: Partial<CssAnimation> = {};
  let times = 0;
  for (const token of item.match(TOKEN) ?? []) {
    const t = cssTime(token);
    const word = token.toLowerCase();
    if (t !== null) {
      if (times++ === 0) out.duration = t;
      else out.delay = t;
    } else if (word === 'infinite' || /^\d*\.?\d+$/.test(word)) out.iterations = word === 'infinite' ? Infinity : Number(word);
    else if (DIRECTIONS.has(word) && out.direction === undefined) out.direction = word as CssDirection;
    else if (FILLS.has(word) && out.fill === undefined && word !== 'none') out.fill = word as CssFillMode;
    else if (word === 'running' || word === 'paused') continue;
    else {
      const e = cssEasing(token);
      if (e !== null) out.easing = e;
      else out.name = token;
    }
  }
  return out;
}

const LONGHANDS = ['name', 'duration', 'delay', 'timing-function', 'iteration-count', 'direction', 'fill-mode'] as const;

/** `el`'s animations, in the order its `animation-name` lists them; none for `none`. */
export function animationsOf(el: Element): CssAnimation[] {
  const shorthand = declaredOf(el, 'animation');
  const items = shorthand ? splitList(shorthand).map((i) => readShorthand(i)) : [];
  const longhand = Object.fromEntries(LONGHANDS.map((l) => [l, declaredOf(el, `animation-${l}`)])) as Record<(typeof LONGHANDS)[number], string | null>;
  const names = longhand.name !== null ? splitList(longhand.name) : items.map((i) => i.name ?? 'none');
  const pick = (l: (typeof LONGHANDS)[number], i: number): string | undefined => {
    const v = longhand[l];
    if (v === null) return undefined;
    const list = splitList(v);
    return list[i % list.length];
  };
  return names.flatMap((name, i): CssAnimation[] => {
    if (name === 'none') return [];
    const item = items[i] ?? {};
    const easingRaw = pick('timing-function', i);
    const easing = easingRaw === undefined ? ('easing' in item ? item.easing : NAMED_EASE) : cssEasing(easingRaw);
    const count = pick('iteration-count', i);
    return [{
      name,
      duration: (pick('duration', i) !== undefined ? cssTime(pick('duration', i)!) : null) ?? item.duration ?? 0,
      delay: (pick('delay', i) !== undefined ? cssTime(pick('delay', i)!) : null) ?? item.delay ?? 0,
      easing: easing === null ? NAMED_EASE : easing,
      iterations: count === undefined ? item.iterations ?? 1 : count === 'infinite' ? Infinity : Number(count),
      direction: (pick('direction', i) as CssDirection | undefined) ?? item.direction ?? 'normal',
      fill: (pick('fill-mode', i) as CssFillMode | undefined) ?? item.fill ?? 'none',
    }];
  });
}

const NAMED_EASE: CssEasing = { bezier: [0.25, 0.1, 0.25, 1] };

function splitList(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '(') depth++;
    else if (raw[i] === ')') depth--;
    else if (raw[i] === ',' && depth === 0) {
      out.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(raw.slice(start).trim());
  return out.filter(Boolean);
}

/** `e` run backward, for an alternate pass: the segment it shapes is traveled the other way. */
export function reversedEasing(e: CssEasing | undefined): CssEasing | undefined {
  if (!e) return e;
  if ('bezier' in e) {
    const [x1, y1, x2, y2] = e.bezier;
    return { bezier: [1 - x2, 1 - y2, 1 - x1, 1 - y1] };
  }
  if ('steps' in e) {
    const jump = e.jump ?? 'end';
    return { steps: e.steps, jump: jump === 'start' ? 'end' : jump === 'end' ? 'start' : jump };
  }
  if ('linear' in e) return { linear: breakpointsOf(e.linear).reverse().map(({ t, v }): LinearPoint => [1 - v, 1 - t]) };
  return e;
}
