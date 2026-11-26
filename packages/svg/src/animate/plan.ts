/**
 * What every animated-SVG writer decides alike: which tracks it can write and on which node, how
 * long a pass is and how often it plays, each key's value as text, and how its own markup joins the
 * caller's decoration.
 */
import type { Clip, ClipKey, ClipSampledTrack } from '@weasel-js/animator';
import { lerp } from '@weasel-js/geom';
import { serializeSvg } from '../serialize';
import type { SerializeOptions } from '../serializeOptions';
import { smilKind } from '../smilValues';
import { withTrimsDrawn } from '../trimmedStroke';
import type { SvgNode, SvgPathNode, SvgStroke } from '../types';
import { numText } from './easing';
import { dashTracksOf, trimEdgesOf, trimmedIdOf, writesOnePath } from './trim';

/** Where a writer reports what it could not write as given. */
export type Warn = (message: string) => void;

/** The formats the writers sharing this plan write. */
export type ClipFormat = 'CSS' | 'SMIL' | 'Lottie';

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

/** A clip worked out once into the tracks every writer writes, with its timing. */
export interface ClipPlan {
  /** One pass, in ms. */
  duration: number;
  /** How many passes play: `Infinity` for a clip that loops. */
  passes: number;
  tracks: PlannedTrack[];
}

/** The decoration a writer adds to the document. */
export interface Written { style?: string; childrenOf?(id: string): string | undefined }

/** Each id in `nodes`, with the kind of node that has it. */
export function nodeKindsIn(nodes: readonly SvgNode[], out = new Map<string, SvgNode['kind']>()): Map<string, SvgNode['kind']> {
  for (const node of nodes) {
    if (node.id !== undefined) out.set(node.id, node.kind);
    if (node.kind === 'group') nodeKindsIn(node.children, out);
  }
  return out;
}

/** The properties SVG lets CSS and SMIL animate on any element. */
const PRESENTATION = new Set([
  'opacity', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'visibility', 'display', 'color',
  'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing', 'word-spacing', 'text-decoration',
]);

/** What each format can animate on a node of each kind, as the writers write that node. */
const CARRIES: Record<ClipFormat, Partial<Record<SvgNode['kind'], ReadonlySet<string>>>> = {
  CSS: { path: new Set([...PRESENTATION, 'd']), group: PRESENTATION, text: PRESENTATION, image: PRESENTATION },
  SMIL: { path: new Set([...PRESENTATION, 'd']), group: PRESENTATION, text: PRESENTATION, image: PRESENTATION },
  Lottie: { path: new Set(['opacity', 'trim.start', 'trim.end']) },
};

/** The element a node of each kind is written as, for warnings. */
const ELEMENTS: Record<SvgNode['kind'], string> = { path: 'a path', group: 'a group', text: 'text', image: 'an image' };

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
 * The tracks of `clip` a writer in `format` can put on the nodes in `kinds` (see `nodeKindsIn`),
 * warning through `warn` for each it cannot.
 */
export function planClip(clip: Clip, kinds: ReadonlyMap<string, SvgNode['kind']>, format: ClipFormat, warn: Warn): ClipPlan {
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
    const split = TARGET.exec(target);
    if (!split) {
      warn(`${target} names no property after its node id; it is skipped`);
      continue;
    }
    const [, id, prop] = split;
    const kind = kinds.get(id);
    if (kind === undefined) {
      warn(`the clip moves #${id}, which no node has; its tracks are skipped`);
      continue;
    }
    if (!CARRIES[format][kind]?.has(prop)) {
      warn(`${target} moves ${prop}, which ${format} cannot animate on ${ELEMENTS[kind]}; it is skipped`);
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

/** `#label`'s stroke losing `dropped` in a writer: the warning every writer gives alike. */
export function strokeLossWarning(label: string, dropped: readonly string[]): string {
  return `${label}'s stroke has ${dropped.join(', ')}, which this writer does not write; the stroke is written without`;
}

/** A trim on `#label`, which has no stroke: the warning every writer gives alike. */
export function strokelessTrimWarning(label: string): string {
  return `${label}'s trim tracks move a stroke it does not have; they are skipped`;
}

/** `nodes` with `edit` applied to each path node whose id is in `ids`. */
function withPathsEdited(nodes: readonly SvgNode[], ids: ReadonlySet<string>, edit: (node: SvgPathNode) => SvgPathNode): SvgNode[] {
  return nodes.map((n) => (n.kind === 'group' ? { ...n, children: withPathsEdited(n.children, ids, edit) }
    : n.kind === 'path' && n.id !== undefined && ids.has(n.id) ? edit(n) : n));
}

function pathsIn(nodes: readonly SvgNode[], out = new Map<string, SvgPathNode>()): Map<string, SvgPathNode> {
  for (const n of nodes) {
    if (n.kind === 'group') pathsIn(n.children, out);
    else if (n.kind === 'path' && n.id !== undefined) out.set(n.id, n);
  }
  return out;
}

const bareStroke = ({ trim: _trim, dash: _dash, dashOffset: _offset, ...rest }: SvgStroke): SvgStroke => rest;

/** Why a trim on `id` cannot be drawn as a dash, warning as it goes; null where it can. */
function trimRefusal(id: string, node: SvgPathNode | undefined, kind: SvgNode['kind']): string | null {
  if (!node) return `#${id}'s trim is drawn as a dash along one <path>, but the node is ${ELEMENTS[kind]}; its trim tracks are skipped`;
  if (!node.stroke) return strokelessTrimWarning(`#${id}`);
  if (!writesOnePath({ ...node, stroke: bareStroke(node.stroke) })) {
    return `#${id}'s trim is drawn as a dash along one <path>, but the node is not written as one; its trim tracks are skipped`;
  }
  return null;
}

/**
 * The trims of `clip` as dashes a writer can draw, and `nodes` ready to carry them: each trimmed
 * node's own trim and dash come off its stroke, its own trim becoming where an edge with no track
 * rests. A trim on a node that is not one stroked `<path>` is skipped with a warning; one on an id
 * no node has is left for `planClip` to warn about.
 */
function withTrimsAsDashes(nodes: readonly SvgNode[], clip: Clip, warn: Warn): { nodes: SvgNode[]; clip: Clip; trimmed: ReadonlySet<string> } {
  const paths = pathsIn(nodes);
  const kinds = nodeKindsIn(nodes);
  const refused = new Set<string>();
  const kept = new Set<string>();
  for (const id of new Set(clip.tracks.map(trimmedIdOf))) {
    const kind = id === undefined ? undefined : kinds.get(id);
    if (id === undefined || kind === undefined) continue;
    const node = paths.get(id);
    const refusal = trimRefusal(id, node, kind);
    if (refusal) {
      warn(refusal);
      refused.add(id);
      continue;
    }
    kept.add(id);
    if (node!.stroke!.dash?.length) warn(strokeLossWarning(`#${id}`, ['dashes']));
  }
  const tracks = clip.tracks.filter((t) => !refused.has(trimmedIdOf(t) ?? ''));
  const restOf = (id: string) => {
    const node = paths.get(id);
    return node && trimEdgesOf(node);
  };
  const { clip: lowered, trimmed } = dashTracksOf({ ...clip, tracks }, restOf);
  return { nodes: withPathsEdited(nodes, kept, (n) => ({ ...n, stroke: bareStroke(n.stroke!) })), clip: lowered, trimmed };
}

/**
 * `nodes` written by `serializeSvg` with `clip` added in `format` by `write`, given the plan of
 * what it can carry. Trim tracks are lowered first (see `dashTracksOf`) and their nodes drawn on
 * `pathLength="1"`. Each warning is said once through `opts.onWarn`; `opts.decorate` is kept and
 * added to.
 */
export function serializeAnimated(
  given: SvgNode[], clip: Clip, opts: SerializeOptions, format: ClipFormat, write: (plan: ClipPlan, warn: Warn) => Written,
): string {
  const warn = createWarnOnce(opts.onWarn);
  const { nodes, clip: lowered, trimmed } = withTrimsAsDashes(given, clip, warn);
  // A node its own empty trim leaves out is written as nothing, so nothing of the clip can reach it.
  const drawn = nodeKindsIn(withTrimsDrawn(nodes));
  const kinds = new Map([...nodeKindsIn(nodes)].filter(([id]) => drawn.has(id)));
  const own = opts.decorate;
  const written = write(planClip(lowered, kinds, format, warn), warn);
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

/** `a` to `b` at `k`, or null where the values do not lerp. */
export function lerpFor(a: ClipKey['value'], b: ClipKey['value'], k: number): ClipKey['value'] | null {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, k);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v) => typeof v === 'number')) {
    return (a as number[]).map((v, i) => lerp(v, b[i] as number, k));
  }
  return null;
}

/** A frame inserted at `t`, holding a lerp of two values already written, which always has text. */
export function frameAt(prop: string, t: number, value: ClipKey['value']): Frame {
  return { t, value, text: valueText(prop, value)!, easing: undefined };
}
