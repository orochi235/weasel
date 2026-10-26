/**
 * Core's presets by name: what `features={['draw']}` resolves through.
 * Importing this module loads every core preset's actions; a canvas handed
 * only preset objects never reaches it.
 */
import type { Action } from '@weasel-js/routing';
import type { BaseFeature, CompositeFeature, FeaturePreset, NamedPresets, PresetSource } from './features';
import { arrangePreset } from './presets/arrange';
import { editPreset } from './presets/edit';
import { ingestPreset } from './presets/ingest';
import { pathsPreset } from './presets/paths';
import { selectPreset } from './presets/select';
import { toolDrivenActions } from './presets/toolDriven';
import { baselineActions } from './presets/baseline';
import { movePreset, outlinePreset, resizePreset, rotatePreset } from './presets/transform';
import { viewPreset } from './presets/view';

/** Each core preset by name. `draw` turns them on in this order. */
export const FEATURE_PRESETS: Readonly<Record<BaseFeature, FeaturePreset>> = {
  view: viewPreset,
  select: selectPreset,
  outline: outlinePreset,
  resize: resizePreset,
  rotate: rotatePreset,
  move: movePreset,
  edit: editPreset,
  arrange: arrangePreset,
  paths: pathsPreset,
  ingest: ingestPreset,
};

const BASE_FEATURES = Object.keys(FEATURE_PRESETS) as BaseFeature[];

/** The base presets each composite preset turns on. */
export const COMPOSITE_FEATURES: Readonly<Record<CompositeFeature, readonly BaseFeature[]>> = {
  pick: ['select', 'outline'],
  transform: ['resize', 'rotate'],
  draw: BASE_FEATURES,
};

/** The names `<SceneCanvas>` resolves. */
export const CORE_NAMED_PRESETS: NamedPresets = { base: FEATURE_PRESETS, composite: COMPOSITE_FEATURES };

/** The kit-standard action ids each preset registers. */
export const FEATURE_ACTION_IDS = Object.fromEntries(
  BASE_FEATURES.map((f): [BaseFeature, readonly string[]] => [f, (FEATURE_PRESETS[f].actions ?? []).map((a) => a.id)]),
) as Readonly<Record<BaseFeature, readonly string[]>>;

/**
 * Kit-standard actions no preset registers: they belong to the tools that bind
 * them. A canvas registers each one whenever a tool it carries names it in a
 * binding — `insert` with any shape tool, `enterTextEdit` with the text tool.
 */
export const TOOL_DRIVEN_ACTION_IDS: readonly string[] = toolDrivenActions.map((a) => a.id);

/** The kit-standard actions every canvas registers, preset or none: undo and redo. */
export const BASELINE_ACTION_IDS: readonly string[] = baselineActions.map((a) => a.id);

/** Every kit-standard action: the baseline, each core preset's in table order, then the
 *  tool-driven ones. */
export const KIT_STANDARD_ACTIONS: readonly Action[] = [
  ...baselineActions,
  ...BASE_FEATURES.flatMap((f) => FEATURE_PRESETS[f].actions ?? []),
  ...toolDrivenActions,
];

/** What `<SceneCanvas>` resolves `features` through: every core name, and
 *  every kit-standard action for its tools to bring. */
export const CORE_PRESET_SOURCE: PresetSource = { named: CORE_NAMED_PRESETS, pool: KIT_STANDARD_ACTIONS, baseline: baselineActions };
