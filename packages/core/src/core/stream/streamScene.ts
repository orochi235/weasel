/**
 * A scene larger than memory, loaded around the view: a source answers the nodes of one cell of a
 * grid over the world, and the stream adds a cell's nodes as it lands and drops them once the view
 * has left it, outside undo history, so a pan records nothing and the visibility index hears of each
 * node by its id rather than rebuilding.
 */
import { createPlaneScheme, TileStream, type PlaneTileKey, type PlaneTileView } from '@weasel-js/tiles';
import type { Dims } from 'core/layers/dims';
import type { View } from 'core/viewport/view';
import type { AddNodeSpec, NodeId, Scene } from 'core/scene/types';

/** One cell of the grid a source answers by: `x, y` count cells from the world's origin. */
export interface SceneCell {
  readonly x: number;
  readonly y: number;
  /** Its world box, `[x0, y0, x1, y1]`. */
  readonly box: readonly [number, number, number, number];
}

/** Where a streamed scene's nodes come from. */
export interface SceneSource<TData, TLayer extends string, TPose> {
  /** World units a cell spans a side. */
  readonly cellSize: number;
  /**
   * The nodes of `cell`, each with an `id` unique across every cell, as roots or under each other.
   * A node belongs to the cell that answers it: it is added when the cell lands and removed when the
   * cell is dropped, unless a recorded edit has touched it, which keeps it in the scene for good and
   * leaves persisting it to the source's owner. Honor `signal`: the view may leave before the load ends.
   */
  load(cell: SceneCell, signal: AbortSignal): Promise<readonly AddNodeSpec<TData, TLayer, TPose>[]>;
}

/** How `streamScene` loads: how many cells at once, how many held, and how far past the view. */
export interface StreamSceneOptions {
  /** Cells loading at once. Default 4. */
  maxConcurrent?: number;
  /** Cells held at once, past those the view wants. Default 64. */
  maxCells?: number;
  /** Cells past the screen's edge to keep loaded. Default 1. */
  margin?: number;
  /** Frames of the view's last motion ahead to load where a fling lands. Default 12. */
  lead?: number;
  /** A load that failed; the cell is asked for again on a later update. */
  onError?(cell: SceneCell, error: unknown): void;
}

/** A scene streamed from a source. */
export interface SceneStream {
  /** Follow the view: load what it shows, its margin and where it is heading; drop what it left. */
  update(view: View, dims: Dims): void;
  /** Cells held and loading, and nodes the stream has in the scene. */
  stats(): { cells: number; loading: number; waiting: number; nodes: number };
  /** Remove every streamed node and stop loading. A node a recorded edit touched stays: it is the
   *  document's now, and undo has to find it. */
  dispose(): void;
}

/** Stream `source`'s nodes into `scene` around the view each `update` names. */
export function streamScene<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  source: SceneSource<TData, TLayer, TPose>,
  opts: StreamSceneOptions = {},
): SceneStream {
  // One cell a tile at level 0 of a scheme whose tiles are a cell wide.
  const scheme = createPlaneScheme(source.cellSize);
  const cellOf = (k: PlaneTileKey): SceneCell => {
    const b = scheme.boundsOf(k);
    return { x: k.x, y: k.y, box: [b[0]!, b[1]!, b[2]!, b[3]!] };
  };
  const streamed = new Set<NodeId>();
  // Nodes a recorded edit has touched are the document's now: undo has to find them, so no drop removes
  // them and no reload adds them again.
  const adopted = new Set<NodeId>();
  // What each streamed node sits under or derives from, as its spec named it: undoing the removal of an
  // adopted node restores it there, so those have to stay too.
  const holders = new Map<NodeId, NodeId[]>();
  const adopt = (id: NodeId) => {
    if (!streamed.delete(id)) return;
    adopted.add(id);
    const up = holders.get(id);
    holders.delete(id);
    for (const h of up ?? []) adopt(h);
  };
  const removePass = scene.addEditPass((edit) => {
    for (const set of [edit.posed, edit.dataChanged, edit.reparented, edit.removed]) for (const id of set) adopt(id);
    return null;
  });
  const stream = new TileStream<PlaneTileKey, PlaneTileView, NodeId[]>({
    scheme, level: 0, maxConcurrent: opts.maxConcurrent ?? 4, maxHeld: opts.maxCells ?? 64,
    load: async (k, signal) => {
      const specs = await source.load(cellOf(k), signal);
      if (signal.aborted) return [];
      const fresh = specs.filter((spec) => spec.id === undefined || (!adopted.has(spec.id) && scene.get(spec.id) === undefined));
      const ids = scene.untracked(() => fresh.map((spec) => scene.add(spec)));
      fresh.forEach((spec, i) => {
        streamed.add(ids[i]!);
        const up = [...(spec.parent ? [spec.parent] : []), ...(Array.isArray(spec.dependsOn) ? spec.dependsOn : [])];
        if (up.length > 0) holders.set(ids[i]!, up);
      });
      return ids;
    },
    release: (_k, ids) => {
      const live = ids.filter((id) => streamed.has(id) && scene.get(id) !== undefined);
      // Removing a node takes its subtree and dependents: one that would take a node the stream does not
      // own (adopted, or the document's own) is the document's now too.
      const kept = new Set(live.filter((id) => scene.removalClosure([id]).some((n) => !streamed.has(n))));
      for (const id of kept) adopt(id);
      for (const id of ids) {
        streamed.delete(id);
        holders.delete(id);
      }
      const drop = live.filter((id) => !kept.has(id));
      if (drop.length > 0) scene.untracked(() => scene.removeMany(drop));
    },
    ...(opts.onError ? { onError: (k: PlaneTileKey, e: unknown) => opts.onError!(cellOf(k), e) } : {}),
  });
  const margin = opts.margin ?? 1;
  const lead = opts.lead ?? 12;
  let last: View | null = null;
  return {
    update(view, dims) {
      const x0 = view.x, y0 = view.y;
      const x1 = view.x + dims.width / view.scale.x, y1 = view.y + dims.height / view.scale.y;
      const box = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
      const at: PlaneTileView = { box, pxPerUnit: 1, ring: margin };
      const dx = last ? (view.x - last.x) * lead : 0, dy = last ? (view.y - last.y) * lead : 0;
      last = { x: view.x, y: view.y, scale: { ...view.scale } };
      const moving = dx !== 0 || dy !== 0;
      stream.update(at, moving ? { box: [box[0]! + dx, box[1]! + dy, box[2]! + dx, box[3]! + dy], pxPerUnit: 1, ring: 0 } : undefined);
    },
    stats: () => ({ cells: stream.count, loading: stream.inFlight, waiting: stream.waiting, nodes: streamed.size }),
    dispose: () => {
      stream.dispose();
      removePass();
    },
  };
}
