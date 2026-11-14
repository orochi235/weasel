import { createContext, useCallback, useRef } from 'react';
import type { CurveLayer, LayerCtx } from './layerTypes';

/** One layer a child of the editor registered: the layer, the state its consumer holds, and where to report changes. */
export interface LayerEntry {
  layer: CurveLayer<unknown>;
  state: unknown;
  onChange(next: unknown): void;
  onCommit?(next: unknown, prev: unknown): void;
  /** The group the layer draws into, whose place in the plot is its place in the stack. */
  el: SVGGElement | null;
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
