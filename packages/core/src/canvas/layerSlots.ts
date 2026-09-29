import type { RenderLayer } from '../core/layers/render';

/** Standard slot names — render in this canonical order.
 *  `cellHighlight` is not an anchor for custom layers: it sits between the
 *  grid and the scene, so anchor to one of those. */
/** @internal */
export const STANDARD_SLOTS = [
  'grid',
  'cellHighlight',
  'scene',
  'selectionOverlay',
] as const;

/** Names of the slots `<Canvas>` supports out of the box (excluding the implicit cell-highlight overlay). */
export type StandardSlotName = Exclude<(typeof STANDARD_SLOTS)[number], 'cellHighlight'>;

/** Custom layer entry — any key not in `STANDARD_SLOTS`. The presence of
 *  `.layer` discriminates this from a slot config. */
export interface CustomLayerEntry {
  layer: RenderLayer<unknown>;
  /** Insert immediately after the named standard slot or another custom-layer key. */
  after?: StandardSlotName | (string & {});
  /** Insert immediately before the named standard slot or another custom-layer key. */
  before?: StandardSlotName | (string & {});
}

export function isCustomEntry(v: unknown): v is CustomLayerEntry {
  return !!v && typeof v === 'object' && 'layer' in (v as Record<string, unknown>);
}
