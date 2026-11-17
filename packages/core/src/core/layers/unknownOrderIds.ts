import { isDev } from '@weasel-js/registry';

const warned = new Set<string>();

/** Warns `message`, in development and once: for a mistake in how the layers are set up, which the frame loop meets
 *  again on every paint. */
export function warnLayersOnce(message: string): void {
  if (!isDev() || warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/** Warns, in development and once per id, about a `layerOrder` id naming no layer in `layers`. */
export function warnUnknownOrderIds(order: readonly string[], layers: ReadonlyMap<string, unknown>): void {
  for (const id of order) {
    if (layers.has(id)) continue;
    warnLayersOnce(
      `[weasel] layerOrder names "${id}", which matches no layer being drawn, so it orders nothing. ` +
      'Check the id against the layer stack — a scene with declared layers draws as "scene:<layerId>".',
    );
  }
}
