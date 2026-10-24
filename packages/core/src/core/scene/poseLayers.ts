/**
 * The fold behind `PoseOverrides.read`: a blits mix over each node's layers of
 * overrides, one voice per depth, cued bottom first, so a later layer folds
 * over an earlier one.
 */
import type { Path } from '@weasel-js/geom';
import { kit, last, mix, mul, patch, type Channel } from '@msb235/blits';
import type { NodeId, PoseOverride } from './types';

/** What a layer says about a node with fewer layers than its depth. */
const NOTHING: PoseOverride<never> = Object.freeze({});

type ShowData = (stored: never) => unknown;

/** Per lower function, per upper one, the two run in turn: kept, so a node
 *  shows one function while neither layer replaces its own. */
const composed = new WeakMap<ShowData, WeakMap<ShowData, ShowData>>();

function after(lower: ShowData, upper: ShowData): ShowData {
  let byUpper = composed.get(lower);
  if (byUpper === undefined) composed.set(lower, byUpper = new WeakMap());
  let both = byUpper.get(upper);
  if (both === undefined) byUpper.set(upper, both = (stored) => upper(lower(stored) as never));
  return both;
}

/** A later layer's data runs on what the layers under it show. */
const DATA: Channel<ShowData> = { merge: after, lerp: (a, b, u) => (u < 0.5 ? a : b) };

/** {@link foldLayers}'s handle. */
export interface LayerFold<Entry> {
  /** Fold `id`'s layers into `out`, as of the last `publish`. */
  probe(id: NodeId, out: Entry): void;
  /** Make the next probe of every node fold afresh, `depth` layers deep at least. */
  publish(depth: number): void;
  /** Forget what the fold keeps for `id`. */
  drop(id: NodeId): void;
}

/** A fold over `layers`, each node's entries bottom first. */
export function foldLayers<TPose, TData>(
  layers: ReadonlyMap<NodeId, readonly PoseOverride<TPose, TData>[]>,
): LayerFold<PoseOverride<TPose, TData>> {
  type Entry = PoseOverride<TPose, TData>;
  const folded = mix<NodeId, Entry>(
    kit<Entry>({
      pose: last<NonNullable<TPose>>(),
      alpha: mul(),
      path: last<Path>(),
      data: DATA as unknown as Channel<NonNullable<Entry['data']>>,
    }),
  );
  let cued = 0;
  // Mix time only has to move between publishes, so a probe after one never
  // hands back the delta a probe before it cached.
  let clock = 0;
  const publish = (depth: number): void => {
    for (; cued < depth; cued++) {
      const k = cued;
      folded.cue({
        patch: patch<NodeId, Entry>(
          0,
          (_phase, id) => layers.get(id)?.[k] ?? (NOTHING as Entry),
          { writes: ['pose', 'alpha', 'path', 'data'] },
        ),
      });
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
