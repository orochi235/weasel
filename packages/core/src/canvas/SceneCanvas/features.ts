/**
 * The behavior presets `<SceneCanvas features>` composes. A bare canvas renders
 * its scene and keeps a selection nothing sets; every behavior beyond that is
 * turned on by naming a preset here.
 *
 * A preset is not one of the `packages/core/src/features/<name>/` source
 * directories that `docs/taxonomy.md` calls a feature; the two share a word
 * and nothing else.
 */
import { never } from 'features/chrome-caps/conditions';
import type { ChromeId, VisibilityRules } from 'features/chrome-caps/types';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import {
  selectionMoveContribution,
  selectionResizeContribution,
  selectionRotateContribution,
} from 'tools/builtin/select/selectionContributions';
import type { Contribution } from 'tools/overlayBinding';
import type { BuiltinToolId } from './props';

/** A preset that names one behavior and abbreviates nothing. */
export type BaseFeature =
  | 'view'
  | 'select'
  | 'outline'
  | 'move'
  | 'resize'
  | 'rotate'
  | 'edit'
  | 'arrange'
  | 'paths'
  | 'ingest';

/** A preset that abbreviates others: `pick` is `select` + `outline`,
 *  `transform` is `resize` + `rotate`, and `draw` is every base preset. */
export type CompositeFeature = 'pick' | 'transform' | 'draw';

/** A behavior preset for `<SceneCanvas features>`. */
export type Feature = BaseFeature | CompositeFeature;

/** Every preset `<SceneCanvas features>` accepts, each composite after the
 *  presets it names. */
export const SCENE_CANVAS_FEATURES: readonly Feature[] = [
  'view', 'select', 'outline', 'pick', 'move', 'resize', 'rotate', 'transform',
  'edit', 'arrange', 'paths', 'ingest', 'draw',
];

/** What a preset's ambient bindings are built from: the `selectTool` options
 *  that configure them. */
export interface FeatureBindingOptions {
  move?: UseMoveOptions<unknown>;
  rotate?: UseRotateOptions<unknown>;
}

/** Everything turning one preset on means. */
export interface FeaturePreset {
  /** The kit-standard actions it registers. */
  actions: readonly string[];
  /** The built-in tools it mounts. */
  tools?: readonly BuiltinToolId[];
  /** Its ambient bindings: an always-live entry routing a gesture to its
   *  actions under any tool that does not claim the gesture itself. */
  ambient?: (options: FeatureBindingOptions) => Contribution;
  /** The selection chrome that is drawn, and can be grabbed, only while it is on. */
  chrome?: readonly ChromeId[];
}

/**
 * What each preset turns on.
 *
 * Row order is the order ambient bindings are matched in, and a tie goes to
 * the first: a handle sits over the selected body, so `resize` and `rotate`
 * come before `move`, whose binding matches a handle drag too.
 *
 * Every id `useStandardActions` knows appears under exactly one preset, except
 * the ones in {@link TOOL_DRIVEN_ACTION_IDS}.
 *
 * Cmd/Ctrl+V arrives as a DOM `paste` event, and two presets answer it.
 * `edit` brings `clipboard.pasteEvent`, which pastes nodes a kit canvas
 * copied and nothing else; `ingest` brings `ingest`, which takes those plus
 * images, SVG, files, consumer content handlers, and every OS drop. With both
 * on, `ingest` answers alone: `useStandardActions` holds
 * `clipboard.pasteEvent` back wherever `ingest` is registered.
 */
export const FEATURE_PRESETS: Readonly<Record<BaseFeature, FeaturePreset>> = {
  view: {
    actions: ['viewport.dragPan', 'viewport.pinchZoom'],
    tools: ['hand'],
  },
  select: {
    actions: ['areaSelect', 'clearSelection', 'lassoSelect'],
    tools: ['select'],
  },
  outline: {
    actions: [],
    chrome: ['selection.outline'],
  },
  resize: {
    actions: ['resize'],
    ambient: () => selectionResizeContribution(),
    chrome: ['selection.resize-handles'],
  },
  rotate: {
    actions: ['rotate'],
    ambient: ({ rotate }) => selectionRotateContribution({ rotate }),
    chrome: ['selection.rotation-handle'],
  },
  move: {
    actions: ['move', 'clone'],
    ambient: ({ move }) => selectionMoveContribution({ move }),
  },
  edit: {
    actions: [
      'escape', 'cancelGesture', 'selectAll', 'duplicate', 'transformAgain', 'delete',
      'group', 'ungroup', 'undo', 'redo',
      'nudge.up', 'nudge.down', 'nudge.left', 'nudge.right',
      'clipboard.cut', 'clipboard.copy', 'clipboard.paste', 'clipboard.pasteEvent',
      'setFill', 'setStroke', 'setFillOpacity', 'setStrokeOpacity',
    ],
  },
  arrange: {
    actions: [
      'flip',
      'reorder.forward', 'reorder.backward',
      'align.left', 'align.centerX', 'align.right',
      'align.top', 'align.centerY', 'align.bottom',
      'distribute.horizontal', 'distribute.vertical',
    ],
  },
  paths: {
    actions: [
      'pathfinder.union', 'pathfinder.subtract', 'pathfinder.intersect',
      'pathfinder.exclude', 'pathfinder.divide', 'pathfinder.crop', 'pathfinder.trim', 'pathfinder.merge',
      'createOutlines', 'outlineStroke',
      'editAnchors', 'enterPathEdit', 'exitPathEdit', 'insertPathAnchor', 'bendSegment',
      'nudgeAnchors.up', 'nudgeAnchors.down', 'nudgeAnchors.left', 'nudgeAnchors.right',
      'deleteAnchors', 'cutPathAtAnchor', 'simplifyBrush', 'pathEditTool.simplifyBrush', 'pathEditTool.exit', 'marqueeAnchors', 'selectAnchor',
      'retractHandles', 'makeHandlesSymmetric', 'averageAnchors', 'joinAnchors',
      'simplifyPath', 'offsetPath', 'snipAtCrossings', 'joinPaths',
    ],
  },
  ingest: {
    actions: ['ingest'],
  },
};

const BASE_FEATURES = Object.keys(FEATURE_PRESETS) as BaseFeature[];

/** The base presets each composite preset turns on. */
export const COMPOSITE_FEATURES: Readonly<Record<CompositeFeature, readonly BaseFeature[]>> = {
  pick: ['select', 'outline'],
  transform: ['resize', 'rotate'],
  draw: BASE_FEATURES,
};

/** The kit-standard actions each preset registers. */
export const FEATURE_ACTION_IDS = Object.fromEntries(
  BASE_FEATURES.map((f) => [f, FEATURE_PRESETS[f].actions]),
) as Readonly<Record<BaseFeature, readonly string[]>>;

/**
 * Kit-standard actions no preset registers: they belong to the tools that bind
 * them. A canvas registers each one whenever a tool it carries names it in a
 * binding — `insert` with any shape tool, `enterTextEdit` with the text tool.
 */
export const TOOL_DRIVEN_ACTION_IDS: readonly string[] = ['insert', 'insert.adjustRotation', 'insert.reposition', 'enterTextEdit'];

/**
 * The base presets a canvas runs with: `features` with every composite
 * expanded, plus `view` whenever the canvas was handed a `viewport` config,
 * since that prop only configures what `view` turns on.
 */
export function resolveFeatures(
  features: readonly Feature[] | undefined,
  opts: { viewport?: boolean } = {},
): ReadonlySet<BaseFeature> {
  const out = new Set<BaseFeature>();
  for (const f of features ?? []) {
    if (f in COMPOSITE_FEATURES) {
      for (const b of COMPOSITE_FEATURES[f as CompositeFeature]) out.add(b);
    } else {
      out.add(f as BaseFeature);
    }
  }
  if (opts.viewport) out.add('view');
  return out;
}

/** The kit-standard action ids the given presets register. */
export function featureActionIds(features: ReadonlySet<BaseFeature>): Set<string> {
  const ids = new Set<string>();
  for (const f of features) for (const id of FEATURE_PRESETS[f].actions) ids.add(id);
  return ids;
}

/** The built-in tools the given presets mount. */
export function featureToolIds(features: ReadonlySet<BaseFeature>): Set<BuiltinToolId> {
  const ids = new Set<BuiltinToolId>();
  for (const f of features) for (const id of FEATURE_PRESETS[f].tools ?? []) ids.add(id);
  return ids;
}

/** The given presets' ambient entries, in the order they are matched. */
export function featureAmbient(
  features: ReadonlySet<BaseFeature>,
  options: FeatureBindingOptions,
): Contribution[] {
  return BASE_FEATURES.flatMap((f) => {
    const ambient = features.has(f) ? FEATURE_PRESETS[f].ambient : undefined;
    return ambient ? [ambient(options)] : [];
  });
}

/** Rules hiding the chrome of every preset that is not among `features`.
 *  `never` also takes a handle out of hit-testing, so a hidden one cannot be
 *  grabbed. */
export function featureChromeRules(features: ReadonlySet<BaseFeature>): VisibilityRules {
  const rules: VisibilityRules = {};
  for (const f of BASE_FEATURES) {
    if (features.has(f)) continue;
    for (const id of FEATURE_PRESETS[f].chrome ?? []) rules[id] = never;
  }
  return rules;
}
