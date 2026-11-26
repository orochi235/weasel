/**
 * A clip written as an SVG animated by CSS: one `@keyframes` per node and property, run from a
 * rule selecting the node by its id. The inverse of `readCssAnimations`, naming tracks as it does.
 */
import type { Clip } from '@weasel-js/animator';
import type { SerializeOptions } from '../serializeOptions';
import type { SvgNode } from '../types';
import { cssTimingOf, numText } from './easing';
import { serializeAnimated, type ClipPlan, type Frame } from './plan';

interface Rule { statics: string[]; animations: string[]; ends: string[] }

/** What `serializeCssAnimatedSvg` adds to `serializeSvg`'s options. */
export interface CssAnimatedOptions extends SerializeOptions {
  /**
   * What a viewer who asks for reduced motion sees: `'animate'` plays the clip as for anyone;
   * `'end'` shows every animated property at its value at the clip's end, with no animation, by a
   * `@media (prefers-reduced-motion: reduce)` rule. Default `'animate'`.
   */
  reducedMotion?: 'animate' | 'end';
}

/** Properties CSS reads as lengths, which a bare number is not. */
const LENGTHS = new Set(['stroke-width', 'font-size', 'letter-spacing', 'word-spacing']);

/** `text` as `prop` takes it in CSS: a length in px, path data inside `path()`. */
function cssValue(prop: string, text: string): string {
  if (LENGTHS.has(prop) && /^-?[\d.]+(?:e-?\d+)?$/.test(text)) return `${text}px`;
  if (prop === 'd') return `path("${text}")`;
  return text;
}

/** `s` as a CSS identifier, escaping what an identifier cannot hold as it stands. */
function cssIdent(s: string): string {
  const escape = (c: string): string => `\\${c.codePointAt(0)!.toString(16)} `;
  return s.replace(/[^\w-]/gu, escape).replace(/^(-?)(\d)/, (_m, dash: string, d: string) => dash + escape(d));
}

/** The keyframes of one track, each eased by the key after it. */
function framesOf(prop: string, frames: readonly Frame[], duration: number): string {
  const offsets = offsetsOf(frames.map((f) => (f.t / duration) * 100));
  return frames.map((f, i) => {
    const next = frames[i + 1];
    const timing = next ? `; animation-timing-function: ${cssTimingOf(next.easing)}` : '';
    return `${numText(offsets[i])}% { ${prop}: ${cssValue(prop, f.text)}${timing} }`;
  }).join(' ');
}

/** The smallest step between keyframes, in percent: two selectors at one offset merge into one. */
const NUDGE = 0.0001;

/**
 * Percent offsets with each jump, two keys at one offset, pulled apart: the later key moves
 * `NUDGE` on, or at 100% the earlier moves `NUDGE` back.
 */
function offsetsOf(given: readonly number[]): number[] {
  const out = [...given];
  for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + NUDGE;
  for (let i = out.length - 1; i >= 0 && out[i] > 100; i--) out[i] = 100;
  for (let i = out.length - 2; i >= 0; i--) if (out[i] >= out[i + 1]) out[i] = out[i + 1] - NUDGE;
  return out;
}

/** The stylesheet playing `plan`, and showing its end instead where `reducedMotion` is `'end'`. */
function styleOf({ duration, passes, tracks }: ClipPlan, reducedMotion: 'animate' | 'end'): string {
  const iterations = passes === Infinity ? 'infinite' : numText(passes);
  const rules = new Map<string, Rule>();
  const frames: string[] = [];
  const names = new Set<string>();
  for (const { id, prop, still, frames: keys } of tracks) {
    const rule = rules.get(id) ?? rules.set(id, { statics: [], animations: [], ends: [] }).get(id)!;
    if (still !== undefined) {
      rule.statics.push(`${prop}: ${cssValue(prop, still.text)}`);
      continue;
    }
    let name = `${cssIdent(id)}-${prop}`;
    for (let n = 2; names.has(name); n++) name = `${cssIdent(id)}-${prop}-${n}`;
    names.add(name);
    frames.push(`@keyframes ${name} { ${framesOf(prop, keys, duration)} }`);
    rule.animations.push(`${name} ${numText(duration)}ms linear ${iterations} both`);
    rule.ends.push(`${prop}: ${cssValue(prop, keys[keys.length - 1].text)}`);
  }
  const selectors = [...rules].map(([id, { statics, animations }]) => {
    const declarations = animations.length > 0 ? [...statics, `animation: ${animations.join(', ')}`] : statics;
    return `#${cssIdent(id)} { ${declarations.join('; ')} }`;
  });
  // Later than the rules it overrides, at the same specificity, so it wins by source order alone.
  const ends = [...rules].filter(([, rule]) => rule.ends.length > 0)
    .map(([id, rule]) => `#${cssIdent(id)} { animation: none; ${rule.ends.join('; ')} }`);
  const reduced = reducedMotion === 'end' && ends.length > 0 ? [`@media (prefers-reduced-motion: reduce) { ${ends.join(' ')} }`] : [];
  return [...frames, ...selectors, ...reduced].join('\n');
}

/**
 * `nodes` as an SVG document animated by `clip` in CSS keyframes. Each sampled track
 * `<id>.<property>` runs on the node with that id, for the clip's duration (else to its last key),
 * as often as its `loop` says, filling both ways. Trim tracks are drawn as a dash on
 * `pathLength="1"` (see `dashTracksOf`). A track this cannot write, or whose id no node has, is
 * skipped with a warning through `opts.onWarn`; `opts.decorate` is kept and added to.
 * `opts.reducedMotion` says what a viewer asking for reduced motion sees.
 */
export function serializeCssAnimatedSvg(nodes: SvgNode[], clip: Clip, opts: CssAnimatedOptions = {}): string {
  const { reducedMotion = 'animate', ...rest } = opts;
  return serializeAnimated(nodes, clip, rest, 'CSS', (plan) => {
    const style = styleOf(plan, reducedMotion);
    return style ? { style } : {};
  });
}
