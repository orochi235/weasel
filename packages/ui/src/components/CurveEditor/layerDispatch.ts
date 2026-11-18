import { publishLayer, type LayerEntry } from './layerHost';
import type { LayerCtx, LayerGesture, ModelPoint, PlotPoint } from './layerTypes';

/** One layer's committed edit: what it published, and the state it began from. */
export interface LayerEdit {
  entry: LayerEntry;
  next: unknown;
  prev: unknown;
}

/** Where a press or a context menu landed, in both spaces. */
export interface LayerPoint {
  plot: PlotPoint;
  model: ModelPoint;
}

/**
 * The `commit` a layer's handler is handed, and the edit it leaves behind. A commit is published as it is made, so
 * a layer drawing a one-shot edit and a gesture's first frame alike show it at once.
 */
function committer(entry: LayerEntry, prev: unknown) {
  let edit: LayerEdit | null = null;
  return {
    commit(next: unknown) {
      edit = { entry, next, prev };
      publishLayer(entry, next);
    },
    edit: (): LayerEdit | null => edit,
  };
}

/**
 * Offer a context-menu gesture to the topmost layer claiming the point, and
 * return the edit it committed, if any. The edit's state is published as it is committed, as a pointer edit's is.
 */
export function dispatchContextMenu(
  layers: readonly LayerEntry[],
  at: LayerPoint,
  e: MouseEvent,
  ctx: LayerCtx,
): LayerEdit | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const entry = layers[i];
    const { layer, state } = entry;
    const hit = layer.hitTest?.(state, at.plot, ctx);
    if (!hit) continue;
    const c = committer(entry, state);
    layer.onContextMenu?.(state, hit, e, ctx, { ...at, commit: c.commit });
    return c.edit();
  }
  return null;
}

/** What a press did: the layer that took it, the gesture it started, and the edit it committed on the way. */
export interface PressOutcome {
  entry: LayerEntry;
  /** A layer's hit test claimed the point; otherwise a layer took it as a press in empty space. */
  claimed: boolean;
  gesture: LayerGesture<unknown> | null;
  edit: LayerEdit | null;
}

/**
 * Offer a press to the topmost layer claiming the point, which takes it whatever it does with it. With no claim,
 * each layer is offered it as a press in empty space, top to bottom, until one starts a gesture or commits an edit.
 */
export function dispatchPress(
  layers: readonly LayerEntry[],
  at: LayerPoint,
  e: PointerEvent,
  ctx: LayerCtx,
): PressOutcome | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const entry = layers[i];
    const hit = entry.layer.hitTest?.(entry.state, at.plot, ctx);
    if (!hit) continue;
    const c = committer(entry, entry.state);
    const gesture = entry.layer.onPointerDown?.(entry.state, hit, e, ctx, { ...at, commit: c.commit });
    return { entry, claimed: true, gesture: gesture || null, edit: c.edit() };
  }
  for (let i = layers.length - 1; i >= 0; i--) {
    const entry = layers[i];
    if (!entry.layer.onEmptyPointerDown) continue;
    const c = committer(entry, entry.state);
    const gesture = entry.layer.onEmptyPointerDown(entry.state, at.model, e, ctx, { ...at, commit: c.commit });
    const edit = c.edit();
    if (gesture || edit) return { entry, claimed: false, gesture: gesture || null, edit };
  }
  return null;
}

/** Offer a key to one layer, and return the edit it committed, if any. */
export function offerKey(entry: LayerEntry, e: KeyboardEvent, ctx: LayerCtx): LayerEdit | null {
  const c = committer(entry, entry.state);
  entry.layer.onKeyDown?.(entry.state, e, ctx, { commit: c.commit });
  return c.edit();
}
