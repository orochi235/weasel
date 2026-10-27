import { useEffect, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Action } from '@weasel-js/routing';
import { createLongPressFeedbackContribution } from '../../features/longPress/longPressFeedback';
import { createViewMarkerContribution } from '../../features/viewports/viewMarkerDrag';
import { useTools, type Contribution, type Tool, type ToolsApi } from '../../tools/overlayBinding';
import type { SurfaceContribution } from '../surfaceContribution';
import {
  presetActions,
  presetAmbient,
  presetContributions,
  resolveFeatures,
  type EnabledPresets,
  type FeatureBindingOptions,
  type FeatureEntry,
  type NamedPresets,
} from './features';
import type { SceneCanvasProps } from './props';
import type { ToolsPatch } from './toolRegistry';
import { useBuiltinTools } from './useBuiltinTools';

type Props = SceneCanvasProps<unknown, string, unknown>;

/** Discriminate the polymorphic `tools` prop: `ToolsApi` has `setActive`
 *  / `active` / `registry`; the patch record shape has none of those. */
function isToolsApi(tools: ToolsApi | ToolsPatch): tools is ToolsApi {
  return typeof (tools as ToolsApi).setActive === 'function';
}

const presetSerials = new WeakMap<object, number>();
let nextSerial = 0;
const entryKey = (e: FeatureEntry): string => {
  if (typeof e === 'string') return e;
  let n = presetSerials.get(e);
  if (n === undefined) presetSerials.set(e, (n = nextSerial++));
  return `#${n}`;
};

/** The presets a canvas runs with. Keyed on the entries, not the array, so
 *  an inline `features={['draw', pathTools]}` does not re-derive every render. */
export function useEnabledFeatures(
  features: readonly FeatureEntry[] | undefined,
  named: NamedPresets | null,
  hasViewport: boolean,
  selectRotates: boolean,
): EnabledPresets {
  const featuresKey = (features ?? []).map(entryKey).join('|');
  return useMemo(
    () => resolveFeatures(features, named, { viewport: hasViewport, selectRotates }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuresKey, named, hasViewport, selectRotates],
  );
}

/**
 * The canvas's tools: a caller's own `ToolsApi` when the `tools` prop is one
 * (the takeover form), and otherwise the built-ins the presets and
 * `defaultTools` name, patched by a `tools` record.
 */
export function useCanvasTools(args: {
  /** The canvas's select tool, which is built from its scene and pickers. */
  select: Tool;
  /** The canvas's group entry and leave, or null where the select preset is off. */
  groupEntry: Contribution | null;
  enabled: EnabledPresets;
  tools: Props['tools'];
  defaultTools: Props['defaultTools'];
  toolOptions: Props['toolOptions'];
  /** `viewport.inertia`, which is the hand tool's. */
  inertia: NonNullable<Props['viewport']>['inertia'];
  ambient: Props['ambient'];
  /** `null` leaves out the kit's default actions, the marker drag among them. */
  actions: Props['actions'];
  /** `longPress.feedback`. Default true, which installs the kit's own. */
  pressFeedback: NonNullable<Props['longPress']>['feedback'];
  initialActiveTool: Props['initialActiveTool'];
  modes: Props['modes'];
  onToolsCreated: Props['onToolsCreated'];
}): {
  /** What the canvas routes input through: the takeover, or `internal`. */
  tools: ToolsApi;
  /** The canvas's own api, built whether or not a takeover replaces it. */
  internal: ToolsApi;
  takeover: ToolsApi | null;
  /** The surface's own always-on entries a takeover's ambient leaves out: they apply under it too. */
  surface: readonly SurfaceContribution[];
} {
  const { select, enabled, tools: toolsProp, defaultTools, toolOptions, inertia, ambient, initialActiveTool, modes, onToolsCreated } = args;

  const takeover = toolsProp && isToolsApi(toolsProp) ? toolsProp : null;
  const registry = useBuiltinTools({
    select,
    enabled,
    defaultTools,
    patch: toolsProp && !isToolsApi(toolsProp) ? toolsProp : null,
    toolOptions,
    inertia,
  });

  const defaultPressFeedback = useMemo(() => createLongPressFeedbackContribution(), []);
  const feedbackOpt = args.pressFeedback ?? true;
  const pressFeedback = feedbackOpt === true ? defaultPressFeedback : feedbackOpt || null;
  const defaultMarkerDrag = useMemo(() => createViewMarkerContribution(), []);
  const markerDrag = args.actions === null ? null : defaultMarkerDrag;
  const groupEntry = args.actions === null ? null : args.groupEntry;
  const mergedAmbient = useMemo(
    () => [
      ...presetContributions(enabled), ...(groupEntry ? [groupEntry] : []), ...(ambient ?? []),
      ...(pressFeedback ? [pressFeedback] : []), ...(markerDrag ? [markerDrag] : []),
    ],
    [enabled, groupEntry, ambient, pressFeedback, markerDrag],
  );

  const internal = useTools({
    active: initialActiveTool ?? ('select' in registry ? 'select' : null),
    registry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
    ...(modes ? { modes } : {}),
  });
  const tools = takeover ?? internal;
  const takeoverAmbient = takeover?.ambient;
  const surface = useMemo(
    () => (takeoverAmbient && markerDrag && !takeoverAmbient.some((e) => e.id === markerDrag.id) ? [markerDrag] : []),
    [takeoverAmbient, markerDrag],
  );

  const onToolsCreatedRef = useLatest(onToolsCreated);
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools, onToolsCreatedRef]);

  return { tools, internal, takeover, surface };
}

/**
 * The presets' ambient bindings, and the standard actions the canvas
 * registers. The bindings are not tools and sit outside `tools`, so they apply
 * under a takeover too. An action is registered when it is in `baseline`, when an enabled preset brings
 * it, or when it is in `pool` and a tool or contribution on this canvas binds
 * it: a tool brings the actions it routes to, so `defaultTools={['rect']}`
 * works under any preset.
 */
export function useFeatureBindings(args: {
  enabled: EnabledPresets;
  /** Actions registered only when something binds them. */
  pool: readonly Action[];
  /** Actions registered whatever is on. */
  baseline?: readonly Action[];
  tools: Pick<ToolsApi, 'registry' | 'ambient'>;
  move: FeatureBindingOptions['move'];
  rotate: FeatureBindingOptions['rotate'];
  /** Entries the surface installs beside a takeover, with the actions they bring. */
  surface?: readonly SurfaceContribution[];
}): { contributions: Contribution[]; standardActions: Action[] } {
  const { enabled, pool, baseline, tools, move, rotate, surface } = args;
  const contributions = useMemo<Contribution[]>(
    () => [...presetAmbient(enabled, { move, rotate }), ...(surface ?? [])],
    [enabled, move, rotate, surface],
  );
  const standardActions = useMemo(() => {
    const own = [...presetActions(enabled), ...(surface ?? []).flatMap((e) => e.actions ?? [])];
    const ownIds = new Set(own.map((a) => a.id));
    const out = [...(baseline ?? []).filter((a) => !ownIds.has(a.id)), ...own];
    const have = new Set(out.map((a) => a.id));
    const bound = new Set<string>();
    for (const entry of [...Object.values(tools.registry), ...tools.ambient, ...contributions]) {
      for (const b of entry.bindings ?? []) bound.add(b.actionId);
    }
    for (const a of pool) {
      if (bound.has(a.id) && !have.has(a.id)) {
        have.add(a.id);
        out.push(a);
      }
    }
    return out;
  }, [enabled, pool, baseline, tools, contributions, surface]);
  return { contributions, standardActions };
}

