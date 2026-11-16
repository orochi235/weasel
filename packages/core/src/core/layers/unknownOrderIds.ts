import { isDev } from '@weasel-js/registry';

const warned = new Set<string>();

/** Warns, in development and once per id, about a `layerOrder` id naming no layer in `layers`. */
export function warnUnknownOrderIds(order: readonly string[], layers: ReadonlyMap<string, unknown>): void {
  if (!isDev()) return;
  for (const id of order) {
    if (layers.has(id) || warned.has(id)) continue;
    warned.add(id);
    console.warn(
      `[weasel] layerOrder names "${id}", which matches no layer being drawn, so it orders nothing. ` +
      'Check the id against the layer stack — a scene with declared layers draws as "scene:<layerId>".',
    );
  }
}
