import type { Op } from '@weasel-js/core';
import type { Guide } from './types';

/** Where guide ops write: `useGuides()` is one. */
export interface GuideStore {
  addGuide(guide: Guide): void;
  removeGuide(id: string): void;
}

/**
 * Add `guide` to `store` as an op, so a canvas's history undoes it. Guides
 * live outside the scene, so the op writes to the store it closes over and
 * leaves the commit adapter alone; with no registry name it is not kept in a
 * serialized history.
 */
export function addGuideOp(store: GuideStore, guide: Guide): Op {
  return {
    label: 'Add Guide',
    apply: () => { store.addGuide(guide); },
    invert: () => removeGuideOp(store, guide),
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

/** Remove `guide` from `store` as an op; its inverse adds it back. */
export function removeGuideOp(store: GuideStore, guide: Guide): Op {
  return {
    label: 'Remove Guide',
    apply: () => { store.removeGuide(guide.id); },
    invert: () => addGuideOp(store, guide),
  };
}
