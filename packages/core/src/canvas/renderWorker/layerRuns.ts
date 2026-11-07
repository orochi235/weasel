/**
 * How a canvas painted partly by a worker stacks: its layers, in draw order, cut into runs the
 * page paints and runs a worker paints, each run its own canvas. A page layer between two scene
 * layers cuts the scene into two worker runs. The topmost run is always the page's, since its
 * canvas takes the input; it may hold no layer at all.
 */

/** One canvas of the stack and the layer ids it paints, bottom first. */
export interface LayerRun {
  by: 'page' | 'worker';
  ids: readonly string[];
}

/** `ids` in draw order, cut wherever who paints them changes. Visibility does not cut a run, so
 *  hiding a layer leaves the stack as it stands. */
export function layerRuns(ids: readonly string[], byWorker: (id: string) => boolean): LayerRun[] {
  const runs: { by: LayerRun['by']; ids: string[] }[] = [];
  for (const id of ids) {
    const by = byWorker(id) ? 'worker' : 'page';
    const last = runs.at(-1);
    if (last?.by === by) last.ids.push(id);
    else runs.push({ by, ids: [id] });
  }
  if (runs.at(-1)?.by !== 'page') runs.push({ by: 'page', ids: [] });
  return runs;
}

/** A key that changes exactly when the stack's canvases do: the runs' owners and how many. */
export const runsKey = (runs: readonly LayerRun[]): string => runs.map((r) => r.by[0]).join('');

/** Whether layer `id` is one the scene slot built: `scene`, or `scene:<layerId>`. */
export const isSceneLayer = (id: string): boolean => id === 'scene' || id.startsWith('scene:');
