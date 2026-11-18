/**
 * The kit's presets by name, core's view presets and editing's, for
 * `namedFeatures('draw')` and for listings that key presets by name. Importing
 * this module loads every preset's actions; a canvas handed preset objects
 * carries only those.
 */
import type { Action } from '@weasel-js/routing';
import type { FeaturePreset } from '@weasel-js/core';
import { alignPreset, arrangePreset, distributePreset, flipPreset, reorderPreset } from './presets/arrange';
import { drawPreset, pickPreset, transformPreset } from './presets/composites';
import {
  clipboardPreset, contextMenuPreset, deletePreset, duplicatePreset, editPreset, escapePreset, groupPreset,
  nudgePreset, selectAllPreset, stylePreset,
} from './presets/edit';
import { ingestPreset } from './presets/ingest';
import { booleansPreset } from './presets/booleans';
import { pathfinderPreset } from './presets/pathfinder';
import { selectPreset } from './presets/select';
import { selectionPreset } from './presets/selection';
import { viewToolsPreset, BASELINE_ACTIONS, viewPreset } from '@weasel-js/core';
import { insertPreset } from './presets/insert';
import { selectionChromePreset } from './presets/selectionChrome';
import { selectToolsOfferedPreset, selectToolsPreset, shapeToolsOfferedPreset, shapeToolsPreset } from './presets/tools';
import { movePreset, outlinePreset, resizePreset, rotatePreset } from './presets/transform';

/** Each kit preset by name, each after the presets it includes. */
export const FEATURE_PRESETS = {
  selection: selectionPreset,
  insert: insertPreset,
  selectionChrome: selectionChromePreset,
  'toolkit:select': selectToolsOfferedPreset,
  'toolkit:shape': shapeToolsOfferedPreset,
  'tools:select': selectToolsPreset,
  'tools:view': viewToolsPreset,
  'tools:shape': shapeToolsPreset,
  view: viewPreset,
  select: selectPreset,
  outline: outlinePreset,
  pick: pickPreset,
  move: movePreset,
  resize: resizePreset,
  rotate: rotatePreset,
  transform: transformPreset,
  escape: escapePreset,
  contextMenu: contextMenuPreset,
  selectAll: selectAllPreset,
  duplicate: duplicatePreset,
  delete: deletePreset,
  group: groupPreset,
  nudge: nudgePreset,
  style: stylePreset,
  clipboard: clipboardPreset,
  edit: editPreset,
  flip: flipPreset,
  reorder: reorderPreset,
  align: alignPreset,
  distribute: distributePreset,
  arrange: arrangePreset,
  booleans: booleansPreset,
  pathfinder: pathfinderPreset,
  ingest: ingestPreset,
  draw: drawPreset,
} as const satisfies Readonly<Record<string, FeaturePreset>>;

/** A kit preset's name, as `namedFeatures` takes it. */
export type FeatureName = keyof typeof FEATURE_PRESETS;

/** Every kit preset's name, each after the presets it includes. */
export const FEATURE_NAMES = Object.keys(FEATURE_PRESETS) as readonly FeatureName[];
const FEATURES = FEATURE_NAMES;

/**
 * The kit's presets for the given names, in order: `namedFeatures('pick', 'move')`
 * is `[pickPreset, movePreset]`, and means exactly what passing those objects
 * means. It resolves names only; nothing else is implied, so a canvas that
 * pans and zooms names `'view'` (or `'draw'`, which includes it). Importing it
 * puts every kit preset in the bundle; import the objects to carry only those.
 */
export function namedFeatures(...names: readonly FeatureName[]): FeaturePreset[] {
  return names.map((n) => {
    if (!Object.hasOwn(FEATURE_PRESETS, n)) throw new Error(`[namedFeatures] no kit preset is named "${n as string}"`);
    return FEATURE_PRESETS[n];
  });
}

/** The kit-standard action ids each preset registers itself, leaving out those of the presets it includes. */
export const FEATURE_ACTION_IDS = Object.fromEntries(
  FEATURES.map((f): [FeatureName, readonly string[]] => [f, (FEATURE_PRESETS[f].actions ?? []).map((a) => a.id)]),
) as Readonly<Record<FeatureName, readonly string[]>>;

/** Every kit-standard action, each once: the baseline, then each kit preset's actions in table order, then its
 *  tool actions. */
export const KIT_STANDARD_ACTIONS: readonly Action[] = [...new Map([
  ...BASELINE_ACTIONS,
  ...FEATURES.flatMap((f) => FEATURE_PRESETS[f].actions ?? []),
  ...FEATURES.flatMap((f) => FEATURE_PRESETS[f].toolActions ?? []),
].map((a): [string, Action] => [a.id, a])).values()];
