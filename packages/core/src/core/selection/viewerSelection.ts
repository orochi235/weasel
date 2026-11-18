import { createPart } from '@weasel-js/registry';
import type { SelectionApi } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { SelectionStore } from './selectionContract';

const ignore = (): void => {};

/**
 * The selection a canvas keeps when no preset builds one: what `store` holds, read live, and every write
 * ignored, so no input or action the canvas runs changes it. Another writer of the store (the app, undo) still
 * moves it. One view per store.
 */
export const viewerSelection = createPart((store: SelectionStore): SelectionApi => {
  const get = (): NodeId[] => store.getSelection() as NodeId[];
  return {
    get current() { return get(); },
    get,
    contains: (id) => get().includes(id),
    set: ignore,
    add: ignore,
    remove: ignore,
    toggle: ignore,
    clear: ignore,
    applyClick: ignore,
    intentOf: () => 'replace',
    adapterMethods: { getSelection: get, setSelection: ignore },
  };
});

const NOTHING: SelectionStore = { getSelection: () => [], setSelection: ignore, subscribe: () => ignore };

/** A selection that holds nothing and takes no write: what a view outside any surface acts on. */
export const NO_SELECTION: SelectionApi = viewerSelection(NOTHING);
