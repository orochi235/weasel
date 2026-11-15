import { createContext, useCallback, useRef } from 'react';
import type { CurveLayer, LayerCtx } from './layerTypes';

/** One layer a child of the editor registered: the layer, the state its consumer holds, and where to report changes. */
export interface LayerEntry {
  layer: CurveLayer<unknown>;
  state: unknown;
  onInput?(next: unknown): void;
  onChange?(next: unknown, prev: unknown): void;
  onCancel?(): void;
  /** What the layer draws while an edit runs for a consumer that passed no `onInput`. */
  draft?: { state: unknown };
  /** Draws the layer again, for a new draft. */
  redraw(): void;
  /** The group the layer draws into, whose place in the plot is its place in the stack. */
  el: SVGGElement | null;
}

/** The state a layer is at: its draft while it has one, else its consumer's. */
export function stateOf(entry: LayerEntry): unknown {
  return entry.draft ? entry.draft.state : entry.state;
}

/** Report a step of an edit: to the consumer's `onInput`, or into the draft the layer draws without one. */
export function publishLayer(entry: LayerEntry, next: unknown): void {
  if (entry.onInput) { entry.onInput(next); return; }
  entry.draft = { state: next };
  entry.redraw();
}

/** End an edit: the draft goes, and the edit is committed if it changed anything. */
export function settleLayer(entry: LayerEntry, outcome: { commit: unknown; prev: unknown } | 'cancel' | 'unchanged'): void {
  if (entry.draft) { entry.draft = undefined; entry.redraw(); }
  if (outcome === 'cancel') entry.onCancel?.();
  else if (outcome !== 'unchanged') entry.onChange?.(outcome.commit, outcome.prev);
}

/** What the editor hands each layer child: where to register, and what its render sees. */
export interface LayerHost {
  register(entry: LayerEntry): () => void;
  base: Omit<LayerCtx, 'modifiers'>;
  /** The layer whose gesture is in flight. */
  active: LayerEntry | null;
}

export const LayerHostContext = createContext<LayerHost | null>(null);

function stackOrder(a: LayerEntry, b: LayerEntry): number {
  if (!a.el || !b.el) return 0;
  return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * The editor's side of layer registration. `layers()` lists what is registered bottom to top, the order the layers
 * draw in, which is the order their groups sit in the plot.
 */
export function useLayerRegistry() {
  const entries = useRef(new Set<LayerEntry>());
  const register = useCallback((entry: LayerEntry) => {
    entries.current.add(entry);
    return () => { entries.current.delete(entry); };
  }, []);
  const layers = useCallback((): LayerEntry[] => [...entries.current].sort(stackOrder), []);
  return { register, layers };
}
