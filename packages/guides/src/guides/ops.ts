import type { Op } from '@weasel-js/core';
import type { Guide } from './types';

/** Where guide ops write: `useGuides()` is one. */
export interface GuideStore {
  /** Add `guide`, or replace the one with its id where it stands. A new
   *  guide goes in at `index` when given, else at the end. */
  addGuide(guide: Guide, index?: number): void;
  removeGuide(id: string): void;
  getGuides(): readonly Guide[];
}

/**
 * Add `guide` to `store` as an op, so a canvas's history undoes it. Guides
 * live outside the scene, so the op writes to the store it closes over and
 * leaves the commit adapter alone; with no registry name it is not kept in a
 * serialized history. Over a guide with the same id, it replaces that guide,
 * and its inverse puts it back.
 */
export function addGuideOp(store: GuideStore, guide: Guide, index?: number): Op {
  let held: Guide | undefined;
  return {
    label: 'Add Guide',
    apply: () => {
      held = store.getGuides().find((g) => g.id === guide.id);
      store.addGuide(guide, index);
    },
    invert: () => (held ? replaceGuideOp(store, guide, held) : removeGuideOp(store, guide)),
  };
}

/** Put `to` in place of `from`, the guide with the same id, as an op: a
 *  guide moved. Its inverse puts `from` back. */
export function replaceGuideOp(store: GuideStore, from: Guide, to: Guide): Op {
  return {
    label: 'Move Guide',
    apply: () => { store.addGuide(to); },
    invert: () => replaceGuideOp(store, to, from),
  };
}

/** Remove the guide with `guide`'s id from `store` as an op, a no-op when it
 *  holds none. Once applied, its inverse adds back the guide it removed, where
 *  it stood; before, it adds `guide`. */
export function removeGuideOp(store: GuideStore, guide: Guide): Op {
  let applied = false;
  let at = -1;
  let held: Guide | undefined;
  const op: Op = {
    label: 'Remove Guide',
    apply: () => {
      const list = store.getGuides();
      at = list.findIndex((g) => g.id === guide.id);
      held = list[at];
      applied = true;
      if (held === undefined) return 'noop';
      store.removeGuide(guide.id);
    },
    invert: () => (!applied ? addGuideOp(store, guide) : held ? addGuideOp(store, held, at) : { label: op.label, apply: () => 'noop', invert: () => op }),
  };
  return op;
}
