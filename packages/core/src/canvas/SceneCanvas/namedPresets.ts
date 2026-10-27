/**
 * Core's presets by name: what `features={['draw']}` resolves through.
 * Importing this module loads every core preset's actions; a canvas handed
 * only preset objects never reaches it.
 */
import type { Action } from '@weasel-js/routing';
import type { Feature, FeaturePreset, NamedPresets, PresetSource } from './features';
import {
  alignPreset, arrangePreset, distributePreset, flipPreset, reorderPreset,
} from './presets/arrange';
import { drawPreset, pickPreset, transformPreset } from './presets/composites';
import {
  clipboardPreset, contextMenuPreset, deletePreset, duplicatePreset, editPreset, escapePreset, groupPreset,
  nudgePreset, selectAllPreset, stylePreset,
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

/** Each core preset by name, in the order `SCENE_CANVAS_FEATURES` lists them. */
export const FEATURE_PRESETS: Readonly<Record<Feature, FeaturePreset>> = {
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
};

const FEATURES = Object.keys(FEATURE_PRESETS) as Feature[];

/** The names `<SceneCanvas>` resolves. */
export const CORE_NAMED_PRESETS: NamedPresets = FEATURE_PRESETS;

/** The kit-standard action ids each preset registers itself, leaving out those of the presets it includes. */
export const FEATURE_ACTION_IDS = Object.fromEntries(
  FEATURES.map((f): [Feature, readonly string[]] => [f, (FEATURE_PRESETS[f].actions ?? []).map((a) => a.id)]),
) as Readonly<Record<Feature, readonly string[]>>;

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

/** What `<SceneCanvas>` resolves `features` through: every core name, and
 *  every kit-standard action for its tools to bring. */
export const CORE_PRESET_SOURCE: PresetSource = { named: CORE_NAMED_PRESETS, pool: KIT_STANDARD_ACTIONS, baseline: BASELINE_ACTIONS };
