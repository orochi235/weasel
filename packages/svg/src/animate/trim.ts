/**
 * Trim lowered to what SVG can animate: a stroke drawn on `pathLength="1"` with one dash as long as
 * the trimmed span, moved along by its offset, and hidden while the span is empty, since a dash of
 * length 0 still draws its caps.
 */
import { deepEqual } from '@weasel-js/registry';
import { sampleTrack, type Clip, type ClipKey, type ClipSampledTrack, type ClipTrack, type SampledTrack } from '@weasel-js/animator';

/** The gap after the dash: longer than the whole path, so a second dash never shows. */
const GAP = 1.0001;
const TRIM = /^(.*)\.trim\.(start|end)$/;

type Edges = [start: ClipKey[] | undefined, end: ClipKey[] | undefined];
/** An edge at one time: its value just before and just after, and its first key there, if any. */
interface Side { before: number; after: number; keyed: ClipKey | undefined }
/** Both edges at one time. */
interface Moment { t: number; edges: [Side, Side] }

const REST = [0, 1] as const;

function sideAt(keys: ClipKey[] | undefined, rest: number, t: number): Side {
  if (!keys) return { before: rest, after: rest, keyed: undefined };
  const here = keys.filter((k) => k.t === t);
  if (here.length > 0) return { before: here[0].value as number, after: here[here.length - 1].value as number, keyed: here[0] };
  const v = sampleTrack({ kind: 'sampled', keys } as SampledTrack<number>, t) as number;
  return { before: v, after: v, keyed: undefined };
}

/**
 * How a quantity of the edges at `which` eases from `prev` into `now`: the one easing every edge
 * that moves there moves by over a whole key segment of its own; else linear, which is exact for
 * linear edges and an approximation for the rest.
 */
function easingInto(prev: Moment, now: Moment, which: (0 | 1)[]): ClipKey['easing'] {
  const moving = which.filter((k) => prev.edges[k].after !== now.edges[k].before);
  const into = moving.map((k) => (prev.edges[k].keyed ? now.edges[k].keyed : undefined));
  if (into.length === 0 || into.some((k) => !k || !deepEqual(k.easing, into[0]!.easing))) return undefined;
  return into[0]!.easing;
}

/** Keys for one quantity of the edges: one per moment, two where it jumps. */
function keysOf(moments: Moment[], which: (0 | 1)[], value: (start: number, end: number) => ClipKey['value']): ClipKey[] {
  return moments.flatMap(({ t, edges: [s, e] }, i): ClipKey[] => {
    const before = value(s.before, e.before);
    const after = value(s.after, e.after);
    const easing = i > 0 ? easingInto(moments[i - 1], moments[i], which) : undefined;
    const keys: ClipKey[] = [easing === undefined ? { t, value: before } : { t, value: before, easing }];
    if (!deepEqual(after, before)) keys.push({ t, value: after });
    return keys;
  });
}

const lengthOf = (start: number, end: number): number => Math.max(0, end - start);

/**
 * Visibility through each span: the hold before the first moment, those between moments, and the
 * hold after the last. A span is hidden only where the trimmed length is 0 at both its ends.
 */
function visibilityKeys(moments: Moment[]): ClipKey[] | undefined {
  const empty = ({ edges: [s, e] }: Moment, at: 'before' | 'after'): boolean => lengthOf(s[at], e[at]) <= 0;
  const spans = [
    empty(moments[0], 'before'),
    ...moments.slice(1).map((m, i) => empty(moments[i], 'after') && empty(m, 'before')),
    empty(moments[moments.length - 1], 'after'),
  ];
  if (!spans.includes(true)) return undefined;
  const word = (hidden: boolean): string => (hidden ? 'hidden' : 'visible');
  return moments.flatMap(({ t }, i): ClipKey[] => {
    const [into, from] = [spans[i], spans[i + 1]];
    return into === from ? [{ t, value: word(from) }] : [{ t, value: word(into) }, { t, value: word(from) }];
  });
}

function lowered(id: string, edges: Edges): ClipSampledTrack[] {
  const times = [...new Set(edges.flatMap((keys) => keys?.map((k) => k.t) ?? []))].sort((a, b) => a - b);
  const moments = times.map((t): Moment => ({ t, edges: [sideAt(edges[0], REST[0], t), sideAt(edges[1], REST[1], t)] }));
  const label = `#${id} trim`;
  const tracks: ClipSampledTrack[] = [
    { kind: 'sampled', label, target: `${id}.stroke-dasharray`, keys: keysOf(moments, [0, 1], (s, e) => [lengthOf(s, e), GAP]) },
    { kind: 'sampled', label, target: `${id}.stroke-dashoffset`, keys: keysOf(moments, [0], (s) => -s) },
  ];
  const visibility = visibilityKeys(moments);
  if (visibility) tracks.push({ kind: 'sampled', label, target: `${id}.visibility`, keys: visibility });
  return tracks;
}

/**
 * `clip` with each node's `<id>.trim.start` and `<id>.trim.end` tracks replaced by
 * `<id>.stroke-dasharray`, `<id>.stroke-dashoffset` and, where the trimmed span is ever empty,
 * `<id>.visibility` tracks, keyed at every time either edge has a key. An edge with no track holds
 * at 0 (start) or 1 (end). `trimmed` names the nodes those tracks need drawn on `pathLength="1"`.
 */
export function dashTracksOf(clip: Clip): { clip: Clip; trimmed: ReadonlySet<string> } {
  const edges = new Map<string, Edges>();
  const tracks: ClipTrack[] = [];
  for (const track of clip.tracks) {
    const m = track.kind === 'sampled' && track.keys.length > 0 ? TRIM.exec(track.target ?? '') : null;
    if (!m) {
      tracks.push(track);
      continue;
    }
    const pair = edges.get(m[1]) ?? edges.set(m[1], [undefined, undefined]).get(m[1])!;
    pair[m[2] === 'start' ? 0 : 1] = (track as ClipSampledTrack).keys;
  }
  for (const [id, pair] of edges) tracks.push(...lowered(id, pair));
  return { clip: { ...clip, tracks }, trimmed: new Set(edges.keys()) };
}
