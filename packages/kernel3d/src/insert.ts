/** The `insert` dep over a 3D world: a drag becomes a footprint on the ground. */

import type { InsertDep, InsertEnds, InsertExtras, CommitSelection } from '@weasel-js/core/engine';
import { commitSelectionOps, createInsertOp, defaultCommitAdapter } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/routing';
import { scale as scaleBy, sub, type Vec3 } from '@weasel-js/geom/3d';
import { groundAxes, groundHit } from './ground';
import type { Pose3 } from './pose3';
import type { ViewportSource } from './project';
import { DEFAULT_UP, type Scene3d, type World3d } from './world';

/** The ground-plane rectangle a drag swept out, in world units. */
export interface Footprint {
  /** Centre of the swept rectangle, on the ground plane. */
  center: Vec3;
  /** Extent along the two axes the up axis is not. */
  width: number;
  depth: number;
}

/** The ground points a footprint spans. A drag's two ends are cast rather
 *  than its box's corners: in perspective the other two corners land outside
 *  the rectangle the ends make, and would carry the footprint past a corner
 *  the drag snapped to. */
function footprintPoints(
  bounds: { x: number; y: number; width: number; height: number },
  ends: InsertEnds | undefined,
  cast: (p: { x: number; y: number }) => Vec3 | null,
): Vec3[] {
  if (ends) {
    const start = cast(ends.start);
    const end = cast(ends.end);
    if (!start || !end) return [];
    return ends.fromCenter ? [end, sub(scaleBy(start, 2), end)] : [start, end];
  }
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  ];
  const hits: Vec3[] = [];
  for (const corner of corners) {
    const hit = cast(corner);
    if (!hit) return [];
    hits.push(hit);
  }
  return hits;
}

/** The node a `createInsert` `node` factory makes: what it holds and where it sits, in world terms. */
export interface InsertNode3d<TData, TLayer extends string> {
  data: TData;
  pose: Pose3;
  /** Default the scene's first layer. */
  layer?: TLayer;
  /** The container it goes in. Default the top of the tree. `pose` is stored as given, so under a composition
   *  that carries children it is the pose in that container's frame. */
  parent?: NodeId | null;
}

/** Options for `createInsert`: where it casts from, as a world or as its parts, and what it makes there. */
export type InsertOptions<TData = unknown, TLayer extends string = string> = InsertCommon & (
  | ({
    /** The world the other deps were built from: its viewport, the up its snap and camera turn about, and the
     *  scene a `node` factory's node goes into. */
    world: Pick<World3d<TData, TLayer>, 'viewport' | 'up'> & { scene?: Scene3d<TData, TLayer> };
    viewport?: never;
    up?: never;
  } & InsertMake<TData, TLayer>)
  | {
    /** @deprecated Pass `world`, whose `viewport` this is: `up` then comes from the same place as every other
     *  dep's. */
    viewport: ViewportSource;
    /** @deprecated Pass `world`: a second `up` beside `World3d.up` can disagree with it. Default +y. */
    up?: Vec3;
    world?: never;
    mint: MintFn;
    node?: never;
    selection?: never;
  }
);

type MintFn = (footprint: Footprint, extras: InsertExtras, select?: CommitSelection) => NodeId | null;

/** What the insert makes: a node for the dep to commit, or a `mint` that commits one itself. */
type InsertMake<TData, TLayer extends string> =
  | {
    /**
     * The node a footprint makes, or `null` to decline. The dep gives it an id and commits it to `world.scene`
     * as one undo step, with the selection change the insert asks for, as `<SceneCanvas insertNodeFactories>`
     * does in 2D. Needs `world.scene`.
     */
    node(footprint: Footprint, extras: InsertExtras): InsertNode3d<TData, TLayer> | null;
    /** Where the insert's selection change lands, and undo puts it back. Default the scene's own selection, which
     *  `<SceneCanvas>` uses unless it is handed a `selection`. */
    selection?: InsertSelection;
    mint?: never;
  }
  | {
    /** Makes the node and commits it. Given `select`, it commits that selection change with the node, in the
     *  same batch when it applies ops (`commitSelectionOps`). `node` does all of this for you. */
    mint: MintFn;
    node?: never;
    selection?: never;
  };

/** A selection a `node` insert commits its change to, as the `selection` dep reads and writes one. */
export interface InsertSelection {
  get(): readonly NodeId[];
  set(ids: NodeId[]): void;
}

interface InsertCommon {
  /** The view whose camera a drag is cast through, for a `<CanvasView deps>` of its own. Default the surface's. */
  viewId?: string | null;
  /** Smallest footprint a click-sized drag produces. Default 0.25. */
  minExtent?: number;
}

type Built = { id: NodeId; ops: ReturnType<typeof createInsertOp>[] };

/** `node`'s answer as the ops that insert it into `scene` (`build`), and committed there as one entry with
 *  `select`'s change, on `selection` or else the scene's own (`mint`). */
function nodeMinter<TData, TLayer extends string>(
  scene: Scene3d<TData, TLayer> | undefined,
  node: (footprint: Footprint, extras: InsertExtras) => InsertNode3d<TData, TLayer> | null,
  selection: InsertSelection | undefined,
): { mint: MintFn; build(footprint: Footprint, extras: InsertExtras): Built | null } {
  if (!scene) throw new Error('createInsert: a `node` factory needs `world.scene`, the scene its node goes into.');
  const build = (footprint: Footprint, extras: InsertExtras): Built | null => {
    const made = node(footprint, extras);
    if (!made) return null;
    const id = scene.mintId();
    const layer = made.layer ?? scene.layers[0]?.id;
    const inserted = { id, kind: 'mark' as const, layer, parent: made.parent ?? null, data: made.data, pose: made.pose };
    return { id, ops: [createInsertOp({ node: inserted, label: `Insert ${extras.kind}` })] };
  };
  return {
    build,
    mint(footprint, extras, select) {
      const built = build(footprint, extras);
      if (!built) return null;
      const label = `Insert ${extras.kind}`;
      const ops = [...built.ops, ...commitSelectionOps(select, built.id, label)];
      const adapter = defaultCommitAdapter(scene as never, selection && {
        getSelection: () => [...selection.get()],
        setSelection: (ids) => selection.set(ids),
      });
      return scene.applyBatch(ops, label, adapter) ? built.id : null;
    },
  };
}

/**
 * A drag becomes a footprint on the ground plane: its ends, or without them
 * its box's four corners, are cast onto the plane and the hit points give the
 * extent. One that misses the plane, past the horizon, declines the insert. What node that implies is the consumer's answer — the kernel does
 * not know what it is inserting. The depth the 2D contract cannot express
 * comes from the plane, not from the caller.
 */
export function createInsert<TData = unknown, TLayer extends string = string>(opts: InsertOptions<TData, TLayer>): InsertDep {
  const { viewport, up = DEFAULT_UP } = opts.world ?? { viewport: opts.viewport!, up: opts.up };
  const minExtent = opts.minExtent ?? 0.25;
  const { u, v } = groundAxes(up);
  const made = opts.node ? nodeMinter(opts.world?.scene, opts.node, opts.selection) : null;
  const mint = made ? made.mint : opts.mint!;

  const footprintOf = (
    bounds: { x: number; y: number; width: number; height: number }, ends: InsertEnds | undefined,
  ): Footprint | null => {
    const vp = viewport(opts.viewId);
    const hits = footprintPoints(bounds, ends, (p) => groundHit(vp, p, up));
    if (hits.length === 0) return null;

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const h of hits) {
      minU = Math.min(minU, h[u]); maxU = Math.max(maxU, h[u]);
      minV = Math.min(minV, h[v]); maxV = Math.max(maxV, h[v]);
    }

    const center = { x: 0, y: 0, z: 0 };
    center[u] = (minU + maxU) / 2;
    center[v] = (minV + maxV) / 2;
    return { center, width: Math.max(minExtent, maxU - minU), depth: Math.max(minExtent, maxV - minV) };
  };

  return {
    commit(bounds, extras, ends, select) {
      const footprint = footprintOf(bounds, ends);
      return footprint && mint(footprint, extras, select);
    },
    ...(made && {
      build(bounds, extras, ends) {
        const footprint = footprintOf(bounds, ends);
        return footprint && made.build(footprint, extras);
      },
    }),
  };
}
