import { createEmitter } from '@weasel-js/registry';

/**
 * The selected anchors of the path open in path edit, held by the app so the
 * canvas and the corner controls read one value: the canvas writes it
 * through `PathEditHost.setSelectedAnchors`, and the controls subscribe.
 */
export interface AnchorSelection {
  get(): ReadonlySet<number>;
  set(next: ReadonlySet<number>): void;
  subscribe(listener: () => void): () => void;
}

const NONE: ReadonlySet<number> = new Set();

export function createAnchorSelection(): AnchorSelection {
  let held = NONE;
  const changed = createEmitter();
  return {
    get: () => held,
    set(next) {
      held = next;
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}
