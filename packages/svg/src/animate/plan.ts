/**
 * What every animated-SVG writer decides alike: which tracks it can write and on which node, how
 * long a pass is and how often it plays, each key's value as text, and how its own markup joins the
 * caller's decoration.
 */
import type { Clip, ClipKey, ClipSampledTrack } from '@weasel-js/animator';
import { serializeSvg } from '../serialize';
import type { SerializeOptions } from '../serializeOptions';
import { smilKind } from '../smilValues';
import type { SvgNode } from '../types';
import { numText } from './easing';
import { dashTracksOf } from './trim';

export type Warn = (message: string) => void;

/** A key of a planned track, with its value as the document writes it. */
export interface Frame { t: number; value: ClipKey['value']; text: string; easing: ClipKey['easing'] }

/** One track a writer writes, on node `id`'s `prop`. */
export interface PlannedTrack {
  id: string;
  prop: string;
  /** The key it holds throughout, where it never moves. */
  still?: Frame;
  /** Its keys, held out to 0 and the duration where they stop short of them; empty where `still`. */
  frames: Frame[];
}

export interface ClipPlan {
  /** One pass, in ms. */
  duration: number;
  /** How many passes play: `Infinity` for a clip that loops. */
  passes: number;
  tracks: PlannedTrack[];
}

/** The decoration a writer adds to the document. */
export interface Written { style?: string; childrenOf?(id: string): string | undefined }

export function idsIn(nodes: readonly SvgNode[], out = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.id !== undefined) out.add(node.id);
    if (node.kind === 'group') idsIn(node.children, out);
  }
  return out;
}

/** A key's value as `prop` takes it, or null where it has no text form. */
export function valueText(prop: string, value: ClipKey['value']): string | null {
  if (typeof value === 'number') return numText(value);
  if (typeof value === 'string') return value;
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'number')) return null;
  if (smilKind(prop) === 'color' && value.length === 4) {
    const [r, g, b, a] = value as number[];
    return `rgba(${[r * 255, g * 255, b * 255].map(numText).join(', ')}, ${numText(a)})`;
  }
  return (value as number[]).map(numText).join(' ');
}

/** `frames` held out to 0 and `duration` where they stop short of them. */
function heldOut(frames: Frame[], duration: number): Frame[] {
  const first = frames[0];
  const last = frames[frames.length - 1];
  return [
    ...(first.t > 0 ? [{ ...first, t: 0, easing: undefined }] : []),
    ...frames,
    ...(last.t < duration ? [{ ...last, t: duration, easing: undefined }] : []),
  ];
}

/** The key a track shows at 0: its last key there, else its first. */
function frameAtStart(frames: readonly Frame[]): Frame {
  let i = 0;
  while (i + 1 < frames.length && frames[i + 1].t <= 0) i++;
  return frames[i];
}

/** `onWarn`, saying each message once. */
export function createWarnOnce(onWarn: Warn | undefined): Warn {
  const said = new Set<string>();
  return (message) => {
    if (said.has(message)) return;
    said.add(message);
    onWarn?.(message);
  };
}

/** A track target split into its node id and property; a trim edge's property is `trim.start` or `trim.end`. */
const TARGET = /^(.*?)\.((?:trim\.)?[^.]+)$/;

/**
 * The tracks of `clip` a writer in `format` can put on the nodes whose ids are in `ids`, warning
 * through `warn` for each it cannot.
 */
export function planClip(clip: Clip, ids: ReadonlySet<string>, format: string, warn: Warn): ClipPlan {
  const sampled = clip.tracks.filter((t): t is ClipSampledTrack => t.kind === 'sampled');
  if (sampled.length < clip.tracks.length) warn(`the clip has event or nested timeline tracks, which ${format} cannot carry; they are skipped`);
  const duration = clip.duration ?? Math.max(0, ...sampled.flatMap((t) => t.keys.map((k) => k.t)));
  const passes = clip.loop === true ? Infinity : typeof clip.loop === 'number' ? clip.loop : 1;
  const tracks: PlannedTrack[] = [];
  for (const track of sampled) {
    const target = track.target;
    if (target === undefined || track.keys.length === 0) continue;
    if (/\.transform\.[^.]+$/.test(target)) {
      warn(`${target} moves a transform, which this writer does not write yet; it is skipped`);
      continue;
    }
    const [, id, prop] = TARGET.exec(target) ?? [target, target, ''];
    if (!ids.has(id)) {
      warn(`the clip moves #${id}, which no node has; its tracks are skipped`);
      continue;
    }
    const keys = track.keys.filter((k) => k.t >= 0 && k.t <= duration);
    if (keys.length < track.keys.length) warn(`${target} has keys outside 0..${numText(duration)} ms, which ${format} cannot place; they are dropped`);
    const texts = keys.map((k) => valueText(prop, k.value));
    if (keys.length === 0 || texts.some((v) => v === null)) {
      if (keys.length > 0) warn(`${target} holds a value ${format} cannot write; it is skipped`);
      continue;
    }
    const frames = keys.map((k, i): Frame => ({ t: k.t, value: k.value, text: texts[i]!, easing: k.easing }));
    if (keys.length === 1 || !(duration > 0)) tracks.push({ id, prop, still: frameAtStart(frames), frames: [] });
    else tracks.push({ id, prop, frames: heldOut(frames, duration) });
  }
  return { duration, passes, tracks };
}

/**
 * `nodes` written by `serializeSvg` with `clip` added in `format` by `write`, given the plan of
 * what it can carry. Trim tracks are lowered first (see `dashTracksOf`) and their nodes drawn on
 * `pathLength="1"`. Each warning is said once through `opts.onWarn`; `opts.decorate` is kept and
 * added to.
 */
export function serializeAnimated(
  nodes: SvgNode[], clip: Clip, opts: SerializeOptions, format: string, write: (plan: ClipPlan, warn: Warn) => Written,
): string {
  const warn = createWarnOnce(opts.onWarn);
  const { clip: lowered, trimmed } = dashTracksOf(clip);
  const own = opts.decorate;
  const written = write(planClip(lowered, idsIn(nodes), format, warn), warn);
  const style = [own?.style, written.style].filter(Boolean).join('\n');
  const childrenOf = (id: string): string | undefined => {
    const children = [own?.childrenOf?.(id), written.childrenOf?.(id)].filter(Boolean).join('');
    return children || undefined;
  };
  return serializeSvg(nodes, {
    ...opts,
    decorate: {
      ...own,
      ...(style ? { style } : {}),
      attrsOf: (id) => (trimmed.has(id) ? { ...own?.attrsOf?.(id), pathLength: '1' } : own?.attrsOf?.(id)),
      childrenOf,
    },
  });
}
