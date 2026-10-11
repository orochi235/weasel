import { prefIsCompound, type PrefLeaf, type PrefList } from '@weasel-js/prefs';

/** Whether a leaf's control is rows of its own, which need the row's whole width: the label goes above it. */
export function drawsRows(leaf: PrefLeaf): boolean {
  if (leaf.kind === 'map' || leaf.kind === 'union') return true;
  const item = leaf.kind === 'list' ? (leaf as Partial<PrefList>).item : undefined;
  return item !== undefined && prefIsCompound(item);
}
