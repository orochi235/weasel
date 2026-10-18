/** Something outside React whose changes a paint reads — a mode registry, a
 *  scoping lookup. A notification repaints the canvas; the listener takes no
 *  arguments and the returned function unsubscribes. */
export interface RedrawSource {
  subscribe(listener: () => void): () => void;
}

/** The `subscribe` for a layer that draws `sources`: it notifies whenever any
 *  of them does. A thunk is read when the subscription is made. */
export function subscribeToSources(
  sources: readonly { subscribe?: RedrawSource['subscribe'] }[]
    | (() => readonly { subscribe?: RedrawSource['subscribe'] }[]),
): RedrawSource['subscribe'] {
  return (listener) => {
    const list = typeof sources === 'function' ? sources() : sources;
    const offs = list.flatMap((l) => (l.subscribe ? [l.subscribe(listener)] : []));
    return () => { for (const off of offs) off(); };
  };
}
