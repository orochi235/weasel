import type { RenderLayer } from '../core/layers/render';
import type { SelectionOverlayLayerOpts } from 'features/selection/overlay';
import type { SceneSlotConfig } from './buildSceneLayer';
import type { PathEditingOverlayStyle } from 'features/paths/pathEditingOverlayLayer';

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
 *  minus the `getSelection`/`getPose` the canvas wires automatically and the
 *  `resizeHandles` it takes from the hit-test, so the two cannot disagree. */
export type SelectionOverlaySlotConfig<TPose> = Omit<
  SelectionOverlayLayerOpts<TPose>,
  'getSelection' | 'getPose' | 'resizeHandles'
> & {
  /** Override the auto-wired pose lookup (overlay-aware → adapter fallback). */
  poseById?: (id: string) => TPose | null;
};

/** Path-edit overlay slot config: how `<SceneCanvas>` draws the chrome of the
 *  path whose anchors are being edited. */
export interface PathEditingOverlaySlotConfig {
  /** Anchor and handle marker overrides. */
  style?: PathEditingOverlayStyle;
}

/** Per-slot config union. The key narrows it in practice. */
export type StandardSlotConfig<TNode extends { id: string }, TPose> =
  | SceneSlotConfig<TNode, TPose>
  | SelectionOverlaySlotConfig<TPose>
  | PathEditingOverlaySlotConfig;

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
  /** Scene slot: the config `<SceneCanvas>` builds its layers from, a
   *  pre-built layer that paints the scene in their place, or `null`. A
   *  pre-built layer gets no ghost of a node in flight, which needs `drawOne`. */
  scene?: TSceneSlot | CustomLayerEntry | null;
  /** Selection-overlay slot: the config `<SceneCanvas>` builds the layer
   *  from, a pre-built layer that paints in its place, or `null` for no
   *  selection chrome. */
  selectionOverlay?: SelectionOverlaySlotConfig<TPose> | CustomLayerEntry | null;
  /** Cell-highlight overlay slot, drawn immediately after the grid. Takes a
   *  pre-built layer (`{ layer }`) — e.g. `createCellHighlightLayer` from
   *  `@weasel-js/guides` — or `null`. */
  cellHighlight?: CustomLayerEntry | null;
  /** `<SceneCanvas>`'s anchor-editing overlay, above the selection overlay:
   *  the config it builds the layer from, a pre-built layer, or `null`. */
  pathEditingOverlay?: PathEditingOverlaySlotConfig | CustomLayerEntry | null;
} & {
  [customKey: string]: LayerSlotValue<TNode, TPose> | TSceneSlot | undefined;
};

/** The scene slot once built: its canvas layers, bottom first. Each `key` is
 *  an anchor a custom layer can name (`scene`, or `scene:<layerId>`). */
export interface SceneSlotLayers {
  layers: ReadonlyArray<{ key: string; layer: RenderLayer<unknown> }>;
}

/** What `<Canvas>` composes: a {@link LayersMap} with every slot already a
 *  layer. `<SceneCanvas>` builds one from its `layers` prop. */
export type CanvasLayers = {
  grid?: CustomLayerEntry | null;
  cellHighlight?: CustomLayerEntry | null;
  scene?: SceneSlotLayers | null;
  selectionOverlay?: CustomLayerEntry | null;
} & {
  [customKey: string]: CustomLayerEntry | SceneSlotLayers | null | undefined;
};

/** The layers of `map` that are already built, in its key order: each
 *  `{ layer }` entry and each `null`. A slot config is left out, for whoever
 *  builds it to put back. */
export function builtLayersOf(map: Record<string, unknown>): Record<string, CustomLayerEntry | null> {
  const out: Record<string, CustomLayerEntry | null> = {};
  for (const [key, value] of Object.entries(map)) {
    if (value === null || isCustomEntry(value)) out[key] = value;
  }
  return out;
}
