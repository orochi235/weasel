import type { EventTrack, NestedTimeline, SampledTrack, Track } from '@weasel-js/animator';

export interface LaneRow {
  /** The dotted index path, unique among the rows. */
  key: string;
  /** What the row folds by: each timeline's label down to it, or its kind for one with none, with how many siblings
   *  before it share that, so a track inserted or removed beside it from outside leaves it open or shut. */
  fold: string;
  /** Index path into the track tree, outermost first. */
  path: number[];
  track: Track;
  label: string;
  /** Nesting depth; 0 for a top-level track. */
  depth: number;
  /** Accumulated `at` from every nested parent, in ms. A key drawn on this row
   *  sits at `offset + key.t` on the ruler. */
  offset: number;
  /** Where, on the ruler, the timelines around this row stop playing it: the soonest of their declared
   *  durations, `Infinity` when none declares one. A key past it never plays. */
  end: number;
  kind: Track['kind'];
  /** True only for a sampled track whose every key value is a number — the
   *  sole case where a value axis has an honest meaning. */
  numeric: boolean;
}

function isNumeric(track: Track): boolean {
  if (track.kind !== 'sampled') return false;
  const keys = (track as SampledTrack<unknown>).keys;
  return keys.length > 0 && keys.every((k) => typeof k.value === 'number');
}

/** Flatten the track tree to rows, descending only into expanded nested
 *  timelines. `expanded` holds the `fold` of each open nested row. */
export function buildLanes(
  tracks: readonly Track[],
  expanded: ReadonlySet<string>,
): LaneRow[] {
  const out: LaneRow[] = [];
  const walk = (list: readonly Track[], path: number[], parent: string, depth: number, offset: number, end: number): void => {
    const seen = new Map<string, number>();
    list.forEach((track, i) => {
      const nextPath = [...path, i];
      const name = foldName(track);
      const n = seen.get(name) ?? 0;
      seen.set(name, n + 1);
      const fold = `${parent}${parent ? '/' : ''}${name}${n > 0 ? `#${n}` : ''}`;
      out.push({
        key: nextPath.join('.'),
        fold,
        path: nextPath,
        track,
        label: track.label ?? `${track.kind} ${i}`,
        depth,
        offset,
        end,
        kind: track.kind,
        numeric: isNumeric(track),
      });
      if (track.kind === 'timeline' && expanded.has(fold)) {
        const start = offset + track.at;
        walk(track.timeline.tracks, nextPath, fold, depth + 1, start, Math.min(end, start + (declaredSpan(track.timeline) ?? Infinity)));
      }
    });
  };
  walk(tracks, [], '', 0, 0, Infinity);
  return out;
}

/** A track's part of a fold, its label or else its kind, with the characters a fold joins by escaped. */
const foldName = (track: Track): string => (track.label === undefined ? `(${track.kind})` : track.label.replace(/[\\/#(]/g, '\\$&'));

/** The times of a row's keys or event crossings, in its own time; none for a nested timeline's row. */
export function rowTimes(row: LaneRow): number[] {
  if (row.kind === 'sampled') return (row.track as SampledTrack<unknown>).keys.map((k) => k.t);
  if (row.kind === 'event') return (row.track as EventTrack).events.map((e) => e.t);
  return [];
}

/** The track at an index path, or `undefined` when the path leaves the tree. */
export function trackAtPath(tracks: readonly Track[], path: readonly number[]): Track | undefined {
  let list: readonly Track[] = tracks;
  let found: Track | undefined;
  for (const i of path) {
    found = list[i];
    if (!found) return undefined;
    list = found.kind === 'timeline' ? found.timeline.tracks : [];
  }
  return found;
}

/** A nested timeline's `duration` as the ruler reads it, none below 0, or `undefined` when it declares none. */
function declaredSpan(timeline: NestedTimeline): number | undefined {
  return timeline.duration == null ? undefined : Math.max(0, timeline.duration) || 0;
}

/** How long a nested timeline runs on the ruler: its `duration`, none below 0, or with none, to its last track's end. */
export function timelineSpan(timeline: NestedTimeline): number {
  const declared = declaredSpan(timeline);
  if (declared !== undefined) return declared;
  let end = 0;
  for (const track of timeline.tracks) end = Math.max(end, trackEnd(track));
  return end;
}

function trackEnd(track: Track): number {
  if (track.kind === 'sampled') return track.keys.at(-1)?.t ?? 0;
  if (track.kind === 'event') return track.events.at(-1)?.t ?? 0;
  return track.at + timelineSpan(track.timeline);
}
