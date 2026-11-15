/**
 * Core's presets by name, for `namedFeatures('draw')` and for listings that
 * key presets by name. Importing this module loads every core preset's
 * actions; `<SceneCanvas>` never reaches it, so a canvas handed preset
 * objects carries only those.
 */
import type { Action } from '@weasel-js/routing';
import type { FeaturePreset } from './features';
import {
  alignPreset, arrangePreset, distributePreset, flipPreset, reorderPreset,
} from './presets/arrange';
import { drawPreset, pickPreset, transformPreset } from './presets/composites';
import {
  clipboardPreset, contextMenuPreset, deletePreset, duplicatePreset, editPreset, escapePreset, groupPreset,
  nudgePreset, selectAllPreset, stylePreset, textEditPreset,
} from './presets/edit';
import { ingestPreset } from './presets/ingest';
import {
  anchorKeysPreset, outlinesPreset, pathCommandsPreset, pathEditPreset, pathfinderPreset, pathsPreset,
} from './presets/paths';
import { selectPreset } from './presets/select';
import { toolDrivenActions } from './presets/toolDriven';
import {
  drawToolsPreset, pageToolsPreset, selectToolsPreset, shapeToolsPreset, typeToolsPreset, viewToolsPreset,
} from './presets/tools';
import { BASELINE_ACTIONS } from './presets/baseline';
import { movePreset, outlinePreset, resizePreset, rotatePreset } from './presets/transform';
import { viewPreset } from './presets/view';
import { whiteboardPreset } from './presets/whiteboard';

/** Each core preset by name, each after the presets it includes. */
export const FEATURE_PRESETS = {
  'tools:select': selectToolsPreset,
  'tools:view': viewToolsPreset,
  'tools:shape': shapeToolsPreset,
  'tools:draw': drawToolsPreset,
  'tools:type': typeToolsPreset,
  'tools:page': pageToolsPreset,
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
  textEdit: textEditPreset,
  edit: editPreset,
  flip: flipPreset,
  reorder: reorderPreset,
  align: alignPreset,
  distribute: distributePreset,
  arrange: arrangePreset,
  anchorKeys: anchorKeysPreset,
  pathfinder: pathfinderPreset,
  outlines: outlinesPreset,
  pathEdit: pathEditPreset,
  pathCommands: pathCommandsPreset,
  paths: pathsPreset,
  ingest: ingestPreset,
  draw: drawPreset,
  whiteboard: whiteboardPreset,
} as const satisfies Readonly<Record<string, FeaturePreset>>;

/** A core preset's name, as `namedFeatures` takes it. */
export type FeatureName = keyof typeof FEATURE_PRESETS;

/** Every core preset's name, each after the presets it includes. */
export const FEATURE_NAMES = Object.keys(FEATURE_PRESETS) as readonly FeatureName[];
const FEATURES = FEATURE_NAMES;

/**
 * Core's presets for the given names, in order: `namedFeatures('pick', 'move')`
 * is `[pickPreset, movePreset]`, and means exactly what passing those objects
 * means. It resolves names only; nothing else is implied, so a canvas that
 * pans and zooms names `'view'` (or `'draw'`, which includes it). Importing it
 * puts every core preset in the bundle; import the objects to carry only those.
 */
export function namedFeatures(...names: readonly FeatureName[]): FeaturePreset[] {
  return names.map((n) => {
    if (!Object.hasOwn(FEATURE_PRESETS, n)) throw new Error(`[namedFeatures] no core preset is named "${n as string}"`);
    return FEATURE_PRESETS[n];
  });
}

/** The kit-standard action ids each preset registers itself, leaving out those of the presets it includes. */
export const FEATURE_ACTION_IDS = Object.fromEntries(
  FEATURES.map((f): [FeatureName, readonly string[]] => [f, (FEATURE_PRESETS[f].actions ?? []).map((a) => a.id)]),
) as Readonly<Record<FeatureName, readonly string[]>>;

/**
 * Kit-standard actions no preset registers: they belong to the tools that bind
 * them. A canvas registers each one whenever a tool it carries names it in a
 * binding — `insert` with any shape tool, `enterTextEdit` with the text tool.
 */
export const TOOL_DRIVEN_ACTION_IDS: readonly string[] = toolDrivenActions.map((a) => a.id);

/** The kit-standard actions every canvas registers, preset or none: undo and redo. */
export const BASELINE_ACTION_IDS: readonly string[] = BASELINE_ACTIONS.map((a) => a.id);

/** Every kit-standard action: the baseline, each core preset's in table order, then the
 *  tool-driven ones. */
export const KIT_STANDARD_ACTIONS: readonly Action[] = [
  ...BASELINE_ACTIONS,
  ...FEATURES.flatMap((f) => FEATURE_PRESETS[f].actions ?? []),
  ...toolDrivenActions,
];
