import { prefIsCompound, type PrefLeaf, type PrefList } from '@weasel-js/prefs';
import { rendererOf } from '../PrefsSource/rendererOf';

/** How much of its row a leaf's control takes: the control column beside the label, or the row's whole width under
 *  it. A `stacked` control sets its own width there; a `filled` one is stretched to the row's. */
export type RowWidth = 'column' | 'stacked' | 'filled';

/**
 * The room a leaf's control needs: `filled` where the renderer that draws it, named for its `path` or its kind, asks
 * (`wide`), `stacked` where its control is rows of its own, and the control column otherwise.
 */
export function rowWidthOf(
  leaf: PrefLeaf,
  renderers?: Record<string, { wide?: boolean } | undefined>,
  path?: string,
): RowWidth {
  const custom = path === undefined ? rendererOf(renderers, leaf.kind) : rendererOf(renderers, path, leaf.kind);
  if (custom?.wide === true) return 'filled';
  if (leaf.kind === 'map' || leaf.kind === 'union') return 'stacked';
  const item = leaf.kind === 'list' ? (leaf as Partial<PrefList>).item : undefined;
  return item !== undefined && prefIsCompound(item) ? 'stacked' : 'column';
}
