import type { CurveLayer, LayerCtx, ModelPoint, PlotPoint } from './layerTypes';

/** One layer's committed edit: what it published, and the state it began from. */
export interface LayerEdit {
  id: string;
  next: unknown;
  prev: unknown;
}

/**
 * Offer a context-menu gesture to the topmost layer claiming the point, and
 * return the edit it committed, if any. `publish` receives that edit's state
 * as it is committed, as `onLayerChange` does for a pointer edit.
 */
export function dispatchContextMenu(
  layers: ReadonlyArray<{ layer: CurveLayer<unknown>; state: unknown }>,
  at: { plot: PlotPoint; model: ModelPoint },
  e: MouseEvent,
  ctx: LayerCtx,
  publish: (id: string, next: unknown) => void,
): LayerEdit | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const { layer, state } = layers[i];
    const hit = layer.hitTest?.(state, at.plot, ctx);
    if (!hit) continue;
    let edit: LayerEdit | null = null;
    layer.onContextMenu?.(state, hit, e, ctx, {
      plot: at.plot,
      model: at.model,
      commit(next) {
        edit = { id: layer.id, next, prev: state };
        publish(layer.id, next);
      },
    });
    return edit;
  }
  return null;
}
