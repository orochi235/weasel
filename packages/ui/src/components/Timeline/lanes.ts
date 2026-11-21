import type { NestedTimeline, SampledTrack, Track } from '@weasel-js/animator';

export interface LaneRow {
  /** Stable across re-renders and edits: the dotted index path. */
  key: string;
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
 *  timelines. `expanded` holds the `key` of each open nested row. */
export function buildLanes(
  tracks: readonly Track[],
  expanded: ReadonlySet<string>,
): LaneRow[] {
  const out: LaneRow[] = [];
  const walk = (list: readonly Track[], path: number[], depth: number, offset: number, end: number): void => {
    list.forEach((track, i) => {
      const nextPath = [...path, i];
      const key = nextPath.join('.');
      out.push({
        key,
        path: nextPath,
        track,
        label: track.label ?? `${track.kind} ${i}`,
        depth,
        offset,
        end,
        kind: track.kind,
        numeric: isNumeric(track),
      });
      if (track.kind === 'timeline' && expanded.has(key)) {
        const start = offset + track.at;
        walk(track.timeline.tracks, nextPath, depth + 1, start, Math.min(end, start + (track.timeline.duration ?? Infinity)));
      }
    });
  };
  walk(tracks, [], 0, 0, Infinity);
  return out;
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

/** How long a nested timeline runs on the ruler: its `duration`, none below 0, or with none, to its last track's end. */
export function timelineSpan(timeline: NestedTimeline): number {
  if (timeline.duration != null) return Math.max(0, timeline.duration) || 0;
  let end = 0;
  for (const track of timeline.tracks) end = Math.max(end, trackEnd(track));
  return end;
}

function trackEnd(track: Track): number {
  if (track.kind === 'sampled') return track.keys.at(-1)?.t ?? 0;
  if (track.kind === 'event') return track.events.at(-1)?.t ?? 0;
  return track.at + timelineSpan(track.timeline);
}
