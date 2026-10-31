import type { FeaturePreset } from '@weasel-js/core';
import { gridSnapSource, type GridSnapSourceOptions } from '../sources/grid';
import { createGridLayer, type GridLayerOpts } from './layer';

/** Options for `createGridPreset`: the grid's, and how it snaps. */
export interface GridPresetOptions extends GridLayerOpts {
  /** Preset id. Default `'grid'`. */
  id?: string;
  /** Snap gestures to the grid's lines, on its `spacing`, `unitSystem` and
   *  `scopes`; `origin` is where the snap lattice starts, and `gridOf` gives
   *  containers their own (pair it with `regions` from `sceneGridRegions`
   *  with the same `gridOf`, so what is drawn is what snaps). `false` draws
   *  the grid without snapping to it. Default on, from `(0, 0)`. */
  snap?: false | Pick<GridSnapSourceOptions, 'origin' | 'gridOf'>;
}

/**
 * A grid as one `<SceneCanvas features>` preset: the lattice drawn in the
 * grid slot, and the snap source that pulls gestures onto it.
 */
export function createGridPreset(opts: GridPresetOptions): FeaturePreset {
  const { id = 'grid', snap = {}, ...layer } = opts;
  const { spacing, unitSystem, scopes } = layer;
  return {
    id,
    layers: { grid: { layer: createGridLayer(layer) } },
    snapSources: snap === false ? [] : [gridSnapSource({
      id,
      spacing,
      ...(unitSystem === undefined ? {} : { unitSystem }),
      ...(scopes === undefined ? {} : { scopes }),
      ...snap,
    })],
  };
}
