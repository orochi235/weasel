import type { PrefBase, PrefLeaf } from './schema';

/**
 * A leaf whose value is an object keyed by strings nobody declared, every
 * value described by `item`: the keyed counterpart of a {@link PrefList}.
 * `item` is an ordinary leaf of any kind; its `default` is what a new entry
 * starts as, and its `name` names one entry's value.
 */
export interface PrefMap extends PrefBase<'map', Readonly<Record<string, unknown>>> {
  item: PrefLeaf;
}
