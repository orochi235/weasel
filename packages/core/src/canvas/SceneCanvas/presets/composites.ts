import type { FeaturePreset } from '../features';
import { arrangePreset } from './arrange';
import { editPreset } from './edit';
import { ingestPreset } from './ingest';
import { pathsPreset } from './paths';
import { selectPreset } from './select';
import { movePreset, outlinePreset, resizePreset, rotatePreset } from './transform';
import { viewPreset } from './view';

/** Select, and the selection's outline. */
export const pickPreset: FeaturePreset = { id: 'pick', label: 'Pick', includes: [selectPreset, outlinePreset] };

/** Resize and rotate handles. */
export const transformPreset: FeaturePreset = { id: 'transform', label: 'Transform', includes: [resizePreset, rotatePreset] };

/** Every core behavior: view, pick, transform, move, edit, arrange, paths, and ingest. Tools that make things are
 *  left to the canvas, through the `tools:` presets or `defaultTools`. */
export const drawPreset: FeaturePreset = {
  id: 'draw',
  label: 'Draw',
  includes: [
    viewPreset, selectPreset, outlinePreset, resizePreset, rotatePreset, movePreset, editPreset, arrangePreset,
    pathsPreset, ingestPreset,
  ],
};
