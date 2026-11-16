import type { FeaturePreset } from '@weasel-js/core';
import { arrangePreset } from './arrange';
import { editPreset } from './edit';
import { ingestPreset } from './ingest';
import { pathfinderPreset } from './pathfinder';
import { selectPreset } from './select';
import { selectToolKitPreset, shapeToolKitPreset } from './tools';
import { movePreset, outlinePreset, resizePreset, rotatePreset } from './transform';
import { viewPreset } from '@weasel-js/core';

/** Select, and the selection's outline. */
export const pickPreset: FeaturePreset = { id: 'pick', label: 'Pick', includes: [selectPreset, outlinePreset] };

/** Resize and rotate handles. */
export const transformPreset: FeaturePreset = { id: 'transform', label: 'Transform', includes: [resizePreset, rotatePreset] };

/** Every kit behavior: view, pick, transform, move, edit, arrange, the pathfinder, and ingest. Tools that make
 *  things are offered and left to the canvas to mount, through `shapeToolsPreset` or `defaultTools`; path editing
 *  is `@weasel-js/path-tools`'. */
export const drawPreset: FeaturePreset = {
  id: 'draw',
  label: 'Draw',
  includes: [
    viewPreset, selectPreset, outlinePreset, resizePreset, rotatePreset, movePreset, editPreset, arrangePreset,
    pathfinderPreset, ingestPreset, selectToolKitPreset, shapeToolKitPreset,
  ],
};
