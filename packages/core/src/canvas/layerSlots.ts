import type { RenderLayer } from '../core/layers/render';
import type { SelectionOverlayLayerOpts } from 'features/selection/overlay';
import type { SceneSlotConfig } from './buildSceneLayer';

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

/** Selection-overlay slot config — passed through to `createSelectionOverlayLayer`,
 *  minus the `getSelection`/`getPose` Canvas wires automatically. */
export type SelectionOverlaySlotConfig<TPose> = Omit<
  SelectionOverlayLayerOpts<TPose>,
  'getSelection' | 'getPose'
> & {
  /** Override the auto-wired pose lookup (overlay-aware → adapter fallback). */
  poseById?: (id: string) => TPose | null;
};

/** Per-slot config union. The key narrows it in practice. */
export type StandardSlotConfig<TNode extends { id: string }, TPose> =
  | SceneSlotConfig<TNode, TPose>
  | SelectionOverlaySlotConfig<TPose>;

/** What may fill one of the canvas's named layer slots: a config the canvas
 *  builds the layer from, a pre-built layer, or `null` to leave the slot
 *  empty. */
export type LayerSlotValue<TNode extends { id: string }, TPose> =
  | StandardSlotConfig<TNode, TPose>
  | CustomLayerEntry
  | null;

/** The canvas's render stack, as named slots. The standard slots (grid,
 *  scene, selection overlay, cell highlight) fix where a layer sits in the
 *  stack; scene and selection overlay can be configured, and every one can be
 *  given a layer of your own or switched off. Further keys add custom layers.
 *  `TSceneSlot` is what the scene slot accepts: `<SceneCanvas>` takes a
 *  partial config and fills the rest from its defaults. */
export type LayersMap<
  TNode extends { id: string },
  TPose,
  TSceneSlot = SceneSlotConfig<TNode, TPose>,
> = {
  /** Grid slot, beneath the scene. Takes a pre-built layer (`{ layer }`) —
   *  e.g. `createGridLayer` from `@weasel-js/guides` — or `null`. */
  grid?: CustomLayerEntry | null;
  scene?: TSceneSlot | null;
  /** Selection-overlay slot. Canvas constructs the layer from a
   *  `SelectionOverlaySlotConfig`; pass a `CustomLayerEntry` (`{ layer }`) to
   *  supply a pre-built layer (e.g. from `<SceneCanvas>`). */
  selectionOverlay?: SelectionOverlaySlotConfig<TPose> | CustomLayerEntry | null;
  /** Cell-highlight overlay slot, drawn immediately after the grid. Takes a
   *  pre-built layer (`{ layer }`) — e.g. `createCellHighlightLayer` from
   *  `@weasel-js/guides` — or `null`. */
  cellHighlight?: CustomLayerEntry | null;
} & {
  [customKey: string]: LayerSlotValue<TNode, TPose> | TSceneSlot | undefined;
};
