import { annotationLayerIds } from 'core/scene/annotation';

/** Layer ids the scene reports as hidden. Only an explicit `false` hides a
 *  layer: a partial scene stand-in that omits the flag stays pickable. */
export function hiddenLayerIds(
  layers: readonly { id: string; visible?: boolean }[] | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const layer of layers ?? []) {
    if (layer.visible === false) out.add(layer.id);
  }
  return out;
}

/** The layers content picking passes through: the hidden ones, and the
 *  annotation layers, whose aids are not content. */
export function unpickedLayerIds(
  layers: readonly { id: string; visible?: boolean; annotation?: boolean }[] | undefined,
): Set<string> {
  const out = hiddenLayerIds(layers);
  for (const id of annotationLayerIds(layers)) out.add(id);
  return out;
}
