/**
 * CSS animations as clip tracks: each `@keyframes` property an element's `animation` moves becomes
 * a sampled track named as SMIL's are, `<id>.<property>` or `<id>.transform.<type>`, with its
 * iterations, direction, delay and fill laid out as keys. What it cannot carry is reported.
 */
import { sampleTrack, type ClipKey, type ClipSampledTrack, type SampledTrack } from '@weasel-js/animator';
import { parseDeclarations } from './cssScan';
import { declaredOf, keyframesOf } from './cascade';
import { animationsOf, cssEasing, reversedEasing, type CssAnimation, type CssEasing } from './cssTiming';
import { smilKind, smilValue, type SmilValue } from './smilValues';

type Warn = (message: string) => void;

/** Where a looping track starts and how long one period of it is. */
export interface CssLoop { begin: number; period: number }

/** One property's stops in a `@keyframes`: offset 0..1, value as written, and the easing out of it. */
interface Stop { offset: number; raw: string; easing: CssEasing | undefined | null }

const STEP: ClipKey['easing'] = { steps: 1 };
const TRANSFORMS: Readonly<Record<string, string>> = {
  translate: 'translate', translatex: 'translate', translatey: 'translate', scale: 'scale', rotate: 'rotate', skewx: 'skewX', skewy: 'skewY',
};

/** A `@keyframes` body as stops per property. */
function stopsOf(body: string, warn: Warn): Map<string, Stop[]> {
  const out = new Map<string, Stop[]>();
  for (const [, selectors, block] of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = parseDeclarations(block);
    const ease = declarations.find((d) => d.prop === 'animation-timing-function');
    const easing = ease ? cssEasing(ease.value, warn) : null;
    for (const sel of selectors.split(',').map((s) => s.trim().toLowerCase())) {
      const offset = sel === 'from' ? 0 : sel === 'to' ? 1 : sel.endsWith('%') ? Number(sel.slice(0, -1)) / 100 : NaN;
      if (!(offset >= 0 && offset <= 1)) continue;
      for (const d of declarations) {
        if (d.prop === 'animation-timing-function') continue;
        const list = out.get(d.prop) ?? out.set(d.prop, []).get(d.prop)!;
        const same = list.findIndex((s) => s.offset === offset);
        if (same >= 0) list.splice(same, 1);
        list.push({ offset, raw: d.value, easing });
      }
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.offset - b.offset);
  return out;
}

const angle = (raw: string): number | null => {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(deg|rad|turn|grad)?$/i.exec(raw.trim());
  if (!m) return null;
  const k = { deg: 1, rad: 180 / Math.PI, turn: 360, grad: 0.9 }[(m[2] ?? 'deg').toLowerCase() as 'deg'];
  return Number(m[1]) * k;
};
const length = (raw: string): number | null => {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(px)?$/i.exec(raw.trim());
  return m ? Number(m[1]) : null;
};

/** A CSS `transform` of one function as a SMIL type and its numbers, or null. */
function transformOf(raw: string, origin: [number, number]): { type: string; value: number[] } | null {
  const m = /^\s*([\w-]+)\(([^)]*)\)\s*$/.exec(raw);
  if (!m) return raw.trim() === 'none' ? { type: '', value: [] } : null;
  const fn = m[1].toLowerCase();
  const args = m[2].split(/[\s,]+/).filter(Boolean);
  const nums = (read: (s: string) => number | null): number[] | null => {
    const v = args.map(read);
    return v.every((n) => n !== null) ? (v as number[]) : null;
  };
  switch (fn) {
    case 'translate': { const v = nums(length); return v && { type: 'translate', value: [v[0], v[1] ?? 0] }; }
    case 'translatex': { const v = nums(length); return v && { type: 'translate', value: [v[0], 0] }; }
    case 'translatey': { const v = nums(length); return v && { type: 'translate', value: [0, v[0]] }; }
    case 'scale': { const v = nums((s) => (/^[+-]?[\d.]+$/.test(s) ? Number(s) : null)); return v && { type: 'scale', value: [v[0], v[1] ?? v[0]] }; }
    case 'rotate': { const v = nums(angle); return v && { type: 'rotate', value: [v[0], ...origin] }; }
    case 'skewx': case 'skewy': { const v = nums(angle); return v && { type: TRANSFORMS[fn], value: [v[0]] }; }
    default: return null;
  }
}

/** One pass's keys, 0 to `duration`, forward or backward, eased by each stop or else by `a`. */
function passKeys(values: SmilValue[], stops: Stop[], a: CssAnimation, backward: boolean): ClipKey[] {
  const keys = stops.map((s, i): ClipKey => {
    const key: ClipKey = { t: s.offset * a.duration, value: values[i] };
    const into = i > 0 ? (stops[i - 1].easing ?? a.easing) : undefined;
    if (into) key.easing = into;
    return key;
  });
  if (!backward) return keys;
  return keys.map((_k, i, all): ClipKey => {
    const from = all[all.length - 1 - i];
    const next = all[all.length - i];
    const key: ClipKey = { t: a.duration - from.t, value: from.value };
    const e = next ? reversedEasing(next.easing as CssEasing | undefined) : undefined;
    if (i > 0 && e) key.easing = e;
    return key;
  });
}

/** Every pass of `a` laid out from its delay; the last cut where a fractional count ends. */
function laidOut(values: SmilValue[], stops: Stop[], a: CssAnimation, lerps: boolean): { keys: ClipKey[]; end: number } {
  const passes = Number.isFinite(a.iterations) ? a.iterations : a.direction.startsWith('alternate') ? 2 : 1;
  const out: ClipKey[] = [];
  for (let k = 0; k < Math.ceil(passes); k++) {
    const backward = a.direction === 'reverse' || (a.direction === 'alternate' && k % 2 === 1) || (a.direction === 'alternate-reverse' && k % 2 === 0);
    const pass = passKeys(values, stops, a, backward);
    const cut = Math.min(1, passes - k) * a.duration;
    const start = a.delay + k * a.duration;
    for (const key of pass) if (key.t <= cut) out.push({ ...key, t: start + key.t, ...(k > 0 && key.t === 0 ? { easing: STEP } : {}) });
    if (cut < a.duration) {
      const track: SampledTrack<unknown> = { kind: 'sampled', keys: pass.map((p) => ({ ...p })) as never };
      out.push({ t: start + cut, value: (lerps ? sampleTrack(track, cut) : [...pass].reverse().find((p) => p.t <= cut)!.value) as SmilValue });
    }
  }
  return { keys: out, end: Number.isFinite(a.iterations) ? a.delay + passes * a.duration : Infinity };
}

/** The tracks `a` makes on `el`, whose id is `id`. */
function tracksOf(el: Element, id: string, a: CssAnimation, warn: Warn): { tracks: ClipSampledTrack[]; loop?: CssLoop } {
  const body = keyframesOf(el.ownerDocument, a.name);
  if (body === undefined) {
    warn(`#${id} runs the animation "${a.name}", which no @keyframes defines`);
    return { tracks: [] };
  }
  if (!(a.duration > 0)) return { tracks: [] };
  const origin = (declaredOf(el, 'transform-origin') ?? '0 0').trim().split(/\s+/).map(length);
  if (origin.some((o) => o === null)) warn(`#${id} has a transform-origin in units the import cannot place; it turns about 0 0`);
  const at: [number, number] = [origin[0] ?? 0, origin[1] ?? origin[0] ?? 0];
  const tracks: ClipSampledTrack[] = [];
  for (const [prop, given] of stopsOf(body, warn)) {
    const stops = [...given];
    const base = prop === 'transform' ? 'none' : declaredOf(el, prop) ?? el.getAttribute(prop);
    // A keyframes rule without a 0% or a 100% for a property starts or ends at the element's own value.
    if (stops[0].offset > 0 && base !== null) stops.unshift({ offset: 0, raw: base, easing: null });
    if (stops[stops.length - 1].offset < 1 && base !== null) stops.push({ offset: 1, raw: base, easing: null });
    let target: string;
    let values: SmilValue[];
    let lerps = true;
    if (prop === 'transform') {
      const read = stops.map((s) => transformOf(s.raw, at));
      const type = read.find((r) => r?.type)?.type;
      if (!type || read.some((r) => r === null || (r.type !== '' && r.type !== type))) {
        warn(`#${id}'s "${a.name}" moves a transform that is not one function of one kind throughout; it is not imported`);
        continue;
      }
      if (type !== 'rotate' && (at[0] !== 0 || at[1] !== 0)) warn(`#${id}'s "${a.name}" scales or skews about a transform-origin; it is imported about 0 0`);
      const neutral = { translate: [0, 0], scale: [1, 1], rotate: [0, ...at], skewX: [0], skewY: [0] }[type as 'translate']!;
      values = read.map((r) => (r!.type === '' ? neutral : r!.value));
      target = `${id}.transform.${type}`;
    } else {
      const kind = smilKind(prop);
      const read = stops.map((s) => smilValue(kind, s.raw));
      if (kind === 'string' || read.some((v) => v === null)) {
        warn(`#${id}'s "${a.name}" moves ${prop}, which the import does not carry`);
        continue;
      }
      values = read as SmilValue[];
      lerps = kind !== 'path';
      target = `${id}.${prop}`;
    }
    const { keys, end } = laidOut(values, stops, a, lerps);
    const first = keys[0];
    if (a.delay > 0) {
      // Before its delay an animation shows its first value only when it fills backwards; else the element's own.
      const holds = a.fill === 'backwards' || a.fill === 'both';
      const before = holds ? first.value : baseValue(prop, base, values);
      if (before !== null) {
        keys.unshift({ t: 0, value: before });
        if (!holds) first.easing = STEP;
      }
    }
    if (Number.isFinite(end) && (a.fill === 'none' || a.fill === 'backwards')) {
      const after = baseValue(prop, base, values);
      if (after !== null) keys.push({ t: end, value: after, easing: STEP });
    }
    tracks.push({ kind: 'sampled', label: `#${id} ${a.name}`, target, keys });
  }
  const loop = Number.isFinite(a.iterations) ? undefined : { begin: a.delay, period: a.direction.startsWith('alternate') ? 2 * a.duration : a.duration };
  return { tracks, ...(loop ? { loop } : {}) };
}

function baseValue(prop: string, base: string | null, values: SmilValue[]): SmilValue | null {
  if (prop === 'transform') return values.find((v) => Array.isArray(v)) ? neutralLike(values[0] as number[]) : null;
  return base === null ? null : smilValue(smilKind(prop), base);
}

const neutralLike = (v: number[]): number[] => (v.length === 2 ? [0, 0] : v.length === 3 ? [0, v[1], v[2]] : [0]);

/**
 * The CSS animations of every element under `root`, as tracks, with the loop of each that runs
 * forever. An animated element without an `id` is given one, `css-1` and on; each is entered in
 * `targets` with what it moves. Of two animations on one property, the later in the list stands.
 */
export function readCssAnimations(root: Element, warn: Warn, targets?: Map<Element, Set<string>>): { tracks: ClipSampledTrack[]; loops: CssLoop[] } {
  const out: ClipSampledTrack[] = [];
  const loops: CssLoop[] = [];
  let minted = 0;
  for (const el of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    if (declaredOf(el, 'animation') === null && declaredOf(el, 'animation-name') === null) continue;
    const animations = animationsOf(el, warn);
    if (animations.length === 0) continue;
    if (!el.id) {
      do el.id = `css-${++minted}`; while (el.ownerDocument.querySelectorAll(`[id="${el.id}"]`).length > 1);
    }
    const byTarget = new Map<string, ClipSampledTrack>();
    for (const a of animations) {
      const { tracks, loop } = tracksOf(el, el.id, a, warn);
      for (const t of tracks) byTarget.set(t.target!, t);
      if (loop && tracks.length > 0) loops.push(loop);
    }
    for (const t of byTarget.values()) {
      out.push(t);
      const moved = t.target!.slice(el.id.length + 1).startsWith('transform.') ? 'transform' : t.target!.slice(el.id.length + 1);
      if (targets) targets.set(el, (targets.get(el) ?? new Set<string>()).add(moved));
    }
  }
  return { tracks: out, loops };
}
