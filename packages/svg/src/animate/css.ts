/**
 * A clip written as an SVG animated by CSS: one `@keyframes` per node and property, run from a
 * rule selecting the node by its id. The inverse of `readCssAnimations`, naming tracks as it does.
 */
import type { Clip, ClipKey, ClipSampledTrack } from '@weasel-js/animator';
import { serializeSvg } from '../serialize';
import type { SerializeOptions } from '../serializeOptions';
import { smilKind } from '../smilValues';
import type { SvgNode } from '../types';
import { cssTimingOf, numText } from './easing';
import { dashTracksOf } from './trim';

type Warn = (message: string) => void;
interface Frame { t: number; value: string; easing: ClipKey['easing'] }
interface Rule { statics: string[]; animations: string[] }

function idsIn(nodes: readonly SvgNode[], out = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.id !== undefined) out.add(node.id);
    if (node.kind === 'group') idsIn(node.children, out);
  }
  return out;
}

/** `s` as a CSS identifier, escaping what an identifier cannot hold as it stands. */
function cssIdent(s: string): string {
  const escape = (c: string): string => `\\${c.codePointAt(0)!.toString(16)} `;
  return s.replace(/[^\w-]/gu, escape).replace(/^(-?)(\d)/, (_m, dash: string, d: string) => dash + escape(d));
}

/** A key's value as `prop` takes it in CSS, or null where it has no CSS form. */
function valueText(prop: string, value: ClipKey['value']): string | null {
  if (typeof value === 'number') return numText(value);
  if (typeof value === 'string') return value;
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'number')) return null;
  if (smilKind(prop) === 'color' && value.length === 4) {
    const [r, g, b, a] = value as number[];
    return `rgba(${[r * 255, g * 255, b * 255].map(numText).join(', ')}, ${numText(a)})`;
  }
  return (value as number[]).map(numText).join(' ');
}

/** The keyframes of one track, held out to 0% and 100% where its keys stop short of them. */
function framesOf(prop: string, keys: readonly ClipKey[], values: readonly string[], duration: number): string {
  const frames: Frame[] = keys.map((k, i) => ({ t: k.t, value: values[i], easing: k.easing }));
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (first.t > 0) frames.unshift({ t: 0, value: first.value, easing: undefined });
  if (last.t < duration) frames.push({ t: duration, value: last.value, easing: undefined });
  return frames.map((f, i) => {
    const next = frames[i + 1];
    const timing = next ? `; animation-timing-function: ${cssTimingOf(next.easing)}` : '';
    return `${numText((f.t / duration) * 100)}% { ${prop}: ${f.value}${timing} }`;
  }).join(' ');
}

/** The value a track shows at 0: its last key there, else its first. */
function valueAtStart(keys: readonly ClipKey[], values: readonly string[]): string {
  const i = keys.findLastIndex((k) => k.t <= 0);
  return values[Math.max(0, i)];
}

/** The stylesheet animating `clip` on the nodes whose ids are in `ids`. */
function styleOf(clip: Clip, ids: ReadonlySet<string>, warn: Warn): string {
  const sampled = clip.tracks.filter((t): t is ClipSampledTrack => t.kind === 'sampled');
  if (sampled.length < clip.tracks.length) warn('the clip has event or nested timeline tracks, which CSS cannot carry; they are skipped');
  const duration = clip.duration ?? Math.max(0, ...sampled.flatMap((t) => t.keys.map((k) => k.t)));
  const iterations = clip.loop === true ? 'infinite' : typeof clip.loop === 'number' ? numText(clip.loop) : '1';
  const rules = new Map<string, Rule>();
  const frames: string[] = [];
  const names = new Set<string>();
  for (const track of sampled) {
    const target = track.target;
    if (target === undefined || track.keys.length === 0) continue;
    if (/\.transform\.[^.]+$/.test(target)) {
      warn(`${target} moves a transform, which this writer does not write yet; it is skipped`);
      continue;
    }
    const dot = target.lastIndexOf('.');
    const id = target.slice(0, dot);
    const prop = target.slice(dot + 1);
    if (!ids.has(id)) {
      warn(`the clip moves #${id}, which no node has; its tracks are skipped`);
      continue;
    }
    const keys = track.keys.filter((k) => k.t >= 0 && k.t <= duration);
    if (keys.length < track.keys.length) warn(`${target} has keys outside 0..${numText(duration)} ms, which CSS cannot place; they are dropped`);
    const values = keys.map((k) => valueText(prop, k.value));
    if (keys.length === 0 || values.some((v) => v === null)) {
      if (keys.length > 0) warn(`${target} holds a value CSS cannot write; it is skipped`);
      continue;
    }
    const texts = values as string[];
    const rule = rules.get(id) ?? rules.set(id, { statics: [], animations: [] }).get(id)!;
    if (keys.length === 1 || !(duration > 0)) {
      rule.statics.push(`${prop}: ${valueAtStart(keys, texts)}`);
      continue;
    }
    let name = `${cssIdent(id)}-${prop}`;
    for (let n = 2; names.has(name); n++) name = `${cssIdent(id)}-${prop}-${n}`;
    names.add(name);
    frames.push(`@keyframes ${name} { ${framesOf(prop, keys, texts, duration)} }`);
    rule.animations.push(`${name} ${numText(duration)}ms linear ${iterations} both`);
  }
  const selectors = [...rules].map(([id, { statics, animations }]) => {
    const declarations = animations.length > 0 ? [...statics, `animation: ${animations.join(', ')}`] : statics;
    return `#${cssIdent(id)} { ${declarations.join('; ')} }`;
  });
  return [...frames, ...selectors].join('\n');
}

/**
 * `nodes` as an SVG document animated by `clip` in CSS keyframes. Each sampled track
 * `<id>.<property>` runs on the node with that id, for the clip's duration (else to its last key),
 * as often as its `loop` says, filling both ways. Trim tracks are drawn as a dash on
 * `pathLength="1"` (see `dashTracksOf`). A track this cannot write, or whose id no node has, is
 * skipped with a warning through `opts.onWarn`; `opts.decorate` is kept and added to.
 */
export function serializeCssAnimatedSvg(nodes: SvgNode[], clip: Clip, opts: SerializeOptions = {}): string {
  const said = new Set<string>();
  const warn: Warn = (message) => {
    if (said.has(message)) return;
    said.add(message);
    opts.onWarn?.(message);
  };
  const { clip: lowered, trimmed } = dashTracksOf(clip);
  const own = opts.decorate;
  const style = [own?.style, styleOf(lowered, idsIn(nodes), warn)].filter(Boolean).join('\n');
  return serializeSvg(nodes, {
    ...opts,
    decorate: {
      ...own,
      ...(style ? { style } : {}),
      attrsOf: (id) => (trimmed.has(id) ? { ...own?.attrsOf?.(id), pathLength: '1' } : own?.attrsOf?.(id)),
    },
  });
}
