import type { SampledTrack, Track } from '@weasel-js/core';

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
  const walk = (list: readonly Track[], path: number[], depth: number, offset: number): void => {
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
        kind: track.kind,
        numeric: isNumeric(track),
      });
      if (track.kind === 'timeline' && expanded.has(key)) {
        walk(track.timeline.tracks, nextPath, depth + 1, offset + track.at);
      }
    });
  };
  walk(tracks, [], 0, 0);
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
