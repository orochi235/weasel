import type { PrefLeaf, PrefList } from '@weasel-js/prefs';

const SEVERAL = new Set(['list', 'map', 'union', 'action']);
const ROWS = new Set(['object', 'list', 'map', 'union']);

/** Whether a leaf's control is several controls or a button. A row drawn as a `<label>` would hand a click on its
 *  text to the first of them. */
export function drawsSeveral(leaf: PrefLeaf): boolean {
  return SEVERAL.has(leaf.kind);
}

/** Whether a leaf's control is rows of its own, which need the row's whole width: the label goes above it. */
export function drawsRows(leaf: PrefLeaf): boolean {
  if (leaf.kind === 'map' || leaf.kind === 'union') return true;
  return leaf.kind === 'list' && ROWS.has((leaf as Partial<PrefList>).item?.kind ?? '');
}
