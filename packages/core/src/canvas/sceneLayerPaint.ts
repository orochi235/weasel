/**
 * Which scene layers a view paints.
 *
 * A view's `layerVisibility` / `layerOrder` name render layers, and `<Canvas>`
 * paints a scene as one render layer per scene layer, keyed `scene:<layerId>`.
 * Picking, marquee and select-all ask about scene layers, so this is where one
 * namespace is read in terms of the other.
 */
import { isLayerVisible, type RenderLayer } from 'core/layers/render';

/** The render-layer id a scene layer paints under. */
export function sceneLayerKey(layerId: string): string {
  return `scene:${layerId}`;
}

/** Per-view layer settings, in `<Canvas>`'s vocabulary. */
export interface ViewLayerPaint {
  /** Narrows the surface's stack before the other two apply. */
  layers?: (surface: readonly RenderLayer<unknown>[]) => readonly RenderLayer<unknown>[];
  layerVisibility?: Record<string, boolean>;
  layerOrder?: readonly string[];
}

/** The layers a view draws, in the order it draws them — the two gates
 *  `drawLayers` applies, over whatever `layers` narrowed to. */
export function paintedLayers(
  surface: readonly RenderLayer<unknown>[],
  view: ViewLayerPaint,
): readonly RenderLayer<unknown>[] {
  const narrowed = view.layers ? view.layers(surface) : surface;
  const order = view.layerOrder;
  const sequence = order
    ? order
      .map((id) => narrowed.find((l) => l.id === id))
      .filter((l): l is RenderLayer<unknown> => l !== undefined)
    : narrowed;
  const visibility = view.layerVisibility ?? {};
  return sequence.filter((l) => isLayerVisible(l, visibility));
}

/**
 * A gate answering "does this scene layer reach the screen in this view",
 * rebuilt only when the surface's stack or the view's settings change — it is
 * asked once per pick candidate.
 *
 * A scene layer is painted when the render layer carrying it is: its own
 * `scene:<id>`, or the bundled `scene` layer an adapter without layers gets.
 * A surface carrying neither paints the scene some other way, which is not
 * this gate's to judge, so it passes.
 */
export function createSceneLayerGate(): (
  surface: readonly RenderLayer<unknown>[],
  view: ViewLayerPaint,
) => (layerId: string) => boolean {
  let last: { inputs: readonly unknown[]; gate: (layerId: string) => boolean } | null = null;
  return (surface, view) => {
    const inputs = [surface, view.layers, view.layerVisibility, view.layerOrder];
    if (last && last.inputs.every((v, i) => v === inputs[i])) return last.gate;
    const byId = new Map(surface.map((l) => [l.id, l]));
    const drawn = new Set(paintedLayers(surface, view));
    const gate = (layerId: string): boolean => {
      const carrier = byId.get(sceneLayerKey(layerId)) ?? byId.get('scene');
      return carrier === undefined || drawn.has(carrier);
    };
    last = { inputs, gate };
    return gate;
  };
}

/** Scene layers in the order a view paints them, for a view that walks the
 *  scene itself rather than a render-layer stack. Keyed as `<SceneCanvas>`
 *  keys them, so one map serves both. */
export function paintedSceneLayers<T extends { id: string }>(
  layers: readonly T[],
  view: Pick<ViewLayerPaint, 'layerVisibility' | 'layerOrder'>,
): readonly T[] {
  const { layerVisibility, layerOrder } = view;
  if (layerVisibility === undefined && layerOrder === undefined) return layers;
  const sequence = layerOrder
    ? layerOrder
      .map((key) => layers.find((l) => sceneLayerKey(l.id) === key))
      .filter((l): l is T => l !== undefined)
    : layers;
  return sequence.filter((l) => layerVisibility?.[sceneLayerKey(l.id)] !== false);
}
