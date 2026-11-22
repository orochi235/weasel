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
   * cell is dropped. Honor `signal`: the view may leave before the load ends.
   */
  load(cell: SceneCell, signal: AbortSignal): Promise<readonly AddNodeSpec<TData, TLayer, TPose>[]>;
}

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
  /** Remove every streamed node and stop loading. */
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
  let nodes = 0;
  const stream = new TileStream<PlaneTileKey, PlaneTileView, NodeId[]>({
    scheme, level: 0, maxConcurrent: opts.maxConcurrent ?? 4, maxHeld: opts.maxCells ?? 64,
    load: async (k, signal) => {
      const specs = await source.load(cellOf(k), signal);
      if (signal.aborted) return [];
      const ids = scene.untracked(() => specs.map((spec) => scene.add(spec)));
      nodes += ids.length;
      return ids;
    },
    release: (_k, ids) => {
      const live = ids.filter((id) => scene.get(id) !== undefined);
      nodes -= ids.length;
      if (live.length > 0) scene.untracked(() => scene.removeMany(live));
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
    stats: () => ({ cells: stream.count, loading: stream.inFlight, waiting: stream.waiting, nodes }),
    dispose: () => stream.dispose(),
  };
}
