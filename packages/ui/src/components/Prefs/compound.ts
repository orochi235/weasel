import { prefIsCompound, type PrefLeaf, type PrefList } from '@weasel-js/prefs';

/** How much of its row a leaf's control takes: the control column beside the label, or the row's whole width under
 *  it. A `stacked` control sets its own width there; a `filled` one is stretched to the row's. */
export type RowWidth = 'column' | 'stacked' | 'filled';

/**
 * The room a leaf's control needs: `filled` where the renderer that draws its kind asks (`wide`), `stacked` where
 * its control is rows of its own, and the control column otherwise.
 */
export function rowWidthOf(leaf: PrefLeaf, renderers?: Record<string, { wide?: boolean } | undefined>): RowWidth {
  if (renderers?.[leaf.kind]?.wide === true) return 'filled';
  if (leaf.kind === 'map' || leaf.kind === 'union') return 'stacked';
  const item = leaf.kind === 'list' ? (leaf as Partial<PrefList>).item : undefined;
  return item !== undefined && prefIsCompound(item) ? 'stacked' : 'column';
}
