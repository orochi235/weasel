type Listener = (path: string) => void;

const listeners = new Set<Listener>();

/** Asks the story tree to show the folder at `path`, as clicking its row would. */
export function revealInTree(path: string): void {
  for (const listener of listeners) listener(path);
}

/** Hears `revealInTree`; returns the unsubscribe. */
export function onRevealInTree(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
