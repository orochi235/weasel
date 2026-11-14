import type { LayerEntry } from './layerHost';
import type { LayerCtx, ModelPoint, PlotPoint } from './layerTypes';

/** One layer's committed edit: what it published, and the state it began from. */
export interface LayerEdit {
  entry: LayerEntry;
  next: unknown;
  prev: unknown;
}

/**
 * Offer a context-menu gesture to the topmost layer claiming the point, and
 * return the edit it committed, if any. The layer's `onChange` receives that
 * edit's state as it is committed, as it does for a pointer edit.
 */
export function dispatchContextMenu(
  layers: readonly LayerEntry[],
  at: { plot: PlotPoint; model: ModelPoint },
  e: MouseEvent,
  ctx: LayerCtx,
): LayerEdit | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const entry = layers[i];
    const { layer, state } = entry;
    const hit = layer.hitTest?.(state, at.plot, ctx);
    if (!hit) continue;
    let edit: LayerEdit | null = null;
    layer.onContextMenu?.(state, hit, e, ctx, {
      plot: at.plot,
      model: at.model,
      commit(next) {
        edit = { entry, next, prev: state };
        entry.onChange(next);
      },
    });
    return edit;
  }
  return null;
}
