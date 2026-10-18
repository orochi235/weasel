import { asNodeId } from './types';

/** The layer-record field the predicates below read. */
export interface AnnotationFlag {
  readonly id: string;
  readonly annotation?: boolean;
}

/**
 * Whether `layer` holds non-printing annotations — measurements, notes —
 * rather than content. The one question export, content picking, and layer
 * palettes ask: what it says no to is drawn on the canvas and saved with the
 * scene, and nothing else.
 */
export function isAnnotationLayer(layer: AnnotationFlag | undefined): boolean {
  return layer?.annotation === true;
}

/** The ids of the annotation layers in `layers`. */
export function annotationLayerIds(layers: readonly AnnotationFlag[] | undefined): Set<string> {
  const out = new Set<string>();
  for (const layer of layers ?? []) if (isAnnotationLayer(layer)) out.add(layer.id);
  return out;
}

/** Whether node `id` sits on one of `scene`'s annotation layers. A node in a
 *  container shares the container's layer, so its own tag is the answer. */
export function isAnnotationNode(
  scene: {
    readonly layers?: readonly AnnotationFlag[];
    get(id: never): { readonly layer: string } | undefined;
  },
  id: string,
): boolean {
  const layer = scene.get(asNodeId(id) as never)?.layer;
  return layer !== undefined && isAnnotationLayer(scene.layers?.find((l) => l.id === layer));
}
