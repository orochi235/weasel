/**
 * The behavior presets `<SceneCanvas features>` composes. A bare canvas renders
 * its scene and keeps a selection nothing sets; every behavior beyond that is
 * turned on by naming a preset here.
 */

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

const BASE_FEATURES: readonly BaseFeature[] = [
  'view', 'select', 'outline', 'move', 'resize', 'rotate', 'edit', 'arrange', 'paths', 'ingest',
];

/** The base presets each composite preset turns on. */
export const COMPOSITE_FEATURES: Readonly<Record<CompositeFeature, readonly BaseFeature[]>> = {
  pick: ['select', 'outline'],
  transform: ['resize', 'rotate'],
  draw: BASE_FEATURES,
};

/**
 * The kit-standard actions each preset registers.
 *
 * Every id `useStandardActions` knows appears under exactly one preset, except
 * the ones in {@link TOOL_DRIVEN_ACTION_IDS}. `move`, `resize` and `rotate`
 * also bring the ambient bindings that route drags to their actions, `select`
 * brings the select tool, and `outline`, `resize` and `rotate` bring their
 * selection chrome; this table is only the registration half.
 */
export const FEATURE_ACTION_IDS: Readonly<Record<BaseFeature, readonly string[]>> = {
  view: ['viewport.dragPan', 'viewport.pinchZoom'],
  select: ['areaSelect', 'clearSelection', 'lassoSelect'],
  outline: [],
  move: ['move', 'clone'],
  resize: ['resize'],
  rotate: ['rotate'],
  edit: [
    'escape', 'cancelGesture', 'selectAll', 'duplicate', 'delete',
    'group', 'ungroup', 'undo', 'redo',
    'nudge.up', 'nudge.down', 'nudge.left', 'nudge.right',
    'clipboard.cut', 'clipboard.copy', 'clipboard.paste',
    'setFill', 'setStroke', 'setFillOpacity', 'setStrokeOpacity',
  ],
  arrange: [
    'flip',
    'reorder.forward', 'reorder.backward',
    'align.left', 'align.centerX', 'align.right',
    'align.top', 'align.centerY', 'align.bottom',
    'distribute.horizontal', 'distribute.vertical',
  ],
  paths: [
    'pathfinder.union', 'pathfinder.subtract', 'pathfinder.intersect',
    'pathfinder.exclude', 'pathfinder.divide', 'pathfinder.crop', 'createOutlines',
    'editAnchors', 'enterPathEdit', 'exitPathEdit', 'insertPathAnchor',
    'nudgeAnchors.up', 'nudgeAnchors.down', 'nudgeAnchors.left', 'nudgeAnchors.right',
    'deleteAnchors', 'cutPathAtAnchor', 'marqueeAnchors', 'selectAnchor',
  ],
  ingest: ['ingest'],
};

/**
 * Kit-standard actions no preset registers: they belong to the tools that bind
 * them. A canvas registers each one whenever a tool it carries names it in a
 * binding — `insert` with any shape tool, `enterTextEdit` with the text tool.
 */
export const TOOL_DRIVEN_ACTION_IDS: readonly string[] = ['insert', 'insert.adjustRotation', 'enterTextEdit'];

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
  for (const f of features) for (const id of FEATURE_ACTION_IDS[f]) ids.add(id);
  return ids;
}
