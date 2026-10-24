/**
 * The fold behind `PoseOverrides.read`: a blits mix over each node's plies of
 * overrides, one voice per depth, cued bottom first, so a later ply folds
 * over an earlier one.
 */
import type { Path } from '@weasel-js/geom';
import { kit, last, mix, mul, patch, type Channel, type Handle } from '@msb235/blits';
import type { NodeId, PoseOverride } from './types';

/** What a ply says about a node with fewer plies than its depth. */
const NOTHING: PoseOverride<never> = Object.freeze({});

type ShowData = (stored: never) => unknown;

/** Per lower function, per upper one, the two run in turn: kept, so a node
 *  shows one function while neither ply replaces its own. */
const composed = new WeakMap<ShowData, WeakMap<ShowData, ShowData>>();

function after(lower: ShowData, upper: ShowData): ShowData {
  let byUpper = composed.get(lower);
  if (byUpper === undefined) composed.set(lower, byUpper = new WeakMap());
  let both = byUpper.get(upper);
  if (both === undefined) byUpper.set(upper, both = (stored) => upper(lower(stored) as never));
  return both;
}

/** A later ply's data runs on what the plies under it show. */
const DATA: Channel<ShowData> = { merge: after, lerp: (a, b, u) => (u < 0.5 ? a : b) };

/** {@link foldPlies}'s handle. */
export interface PlyFold<Entry> {
  /** Fold `id`'s plies into `out`, as of the last `publish`. */
  probe(id: NodeId, out: Entry): void;
  /** Make the next probe of every node fold afresh, `depth` plies deep. */
  publish(depth: number): void;
  /** Forget what the fold keeps for `id`. */
  drop(id: NodeId): void;
}

/** A fold over `plies`, each node's entries bottom first. */
export function foldPlies<TPose, TData>(
  plies: ReadonlyMap<NodeId, readonly PoseOverride<TPose, TData>[]>,
): PlyFold<PoseOverride<TPose, TData>> {
  type Entry = PoseOverride<TPose, TData>;
  const folded = mix<NodeId, Entry>(
    kit<Entry>({
      pose: last<NonNullable<TPose>>(),
      alpha: mul(),
      path: last<Path>(),
      data: DATA as unknown as Channel<NonNullable<Entry['data']>>,
    }),
  );
  /** One voice per depth, bottom first; only ever cut from the top, so cue order stays depth order. */
  const voices: Handle<NodeId>[] = [];
  // Mix time only has to move between publishes, so a probe after one never
  // hands back the delta a probe before it cached.
  let clock = 0;
  const publish = (depth: number): void => {
    while (voices.length > depth) voices.pop()!.fade({ over: 0 });
    while (voices.length < depth) {
      const k = voices.length;
      voices.push(folded.cue({
        patch: patch<NodeId, Entry>(
          0,
          (_phase, id) => plies.get(id)?.[k] ?? (NOTHING as Entry),
          { writes: ['pose', 'alpha', 'path', 'data'] },
        ),
      }));
    }
    folded.sync(clock++);
  };
  publish(1);
  return {
    probe: (id, out) => { folded.probe(id, out); },
    publish,
    drop: (id) => { folded.drop(id); },
  };
}
