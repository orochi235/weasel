/**
 * The behavior presets `<SceneCanvas features>` composes. A bare canvas renders
 * its scene and keeps a selection nothing sets; every behavior beyond that is
 * turned on by naming a preset here.
 */

/** A behavior preset for `<SceneCanvas features>`. `draw` names every other
 *  one. */
export type Feature =
  | 'view'
  | 'pick'
  | 'move'
  | 'transform'
  | 'edit'
  | 'arrange'
  | 'paths'
  | 'ingest'
  | 'draw';

/** Every preset except `draw`, which only abbreviates them. */
export type BaseFeature = Exclude<Feature, 'draw'>;

/** Every preset `<SceneCanvas features>` accepts, `draw` last. */
export const SCENE_CANVAS_FEATURES: readonly Feature[] = [
  'view', 'pick', 'move', 'transform', 'edit', 'arrange', 'paths', 'ingest', 'draw',
];

const BASE_FEATURES: readonly BaseFeature[] =
  SCENE_CANVAS_FEATURES.filter((f): f is BaseFeature => f !== 'draw');

/**
 * The kit-standard actions each preset registers.
 *
 * Every id `useStandardActions` knows appears under exactly one preset, except
 * the ones in {@link TOOL_DRIVEN_ACTION_IDS}. `move` and `transform` also bring
 * the ambient bindings that route drags to their actions, and `pick` brings the
 * select tool; this table is only the registration half.
 */
export const FEATURE_ACTION_IDS: Readonly<Record<BaseFeature, readonly string[]>> = {
  view: ['viewport.dragPan', 'viewport.pinchZoom'],
  pick: ['areaSelect', 'clearSelection', 'lassoSelect'],
  move: ['move', 'clone'],
  transform: ['resize', 'rotate'],
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
 * The presets a canvas runs with: `features` with `draw` expanded, plus `view`
 * whenever the canvas was handed a `viewport` config, since that prop only
 * configures what `view` turns on.
 */
export function resolveFeatures(
  features: readonly Feature[] | undefined,
  opts: { viewport?: boolean } = {},
): ReadonlySet<BaseFeature> {
  const out = new Set<BaseFeature>();
  for (const f of features ?? []) {
    if (f === 'draw') for (const b of BASE_FEATURES) out.add(b);
    else out.add(f);
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
