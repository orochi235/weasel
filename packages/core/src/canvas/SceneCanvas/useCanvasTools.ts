import { createPart } from '@weasel-js/registry';
import { useEffect, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Action } from '@weasel-js/routing';
import { createLongPressFeedbackContribution } from '../../domains/longPress/longPressFeedback';
import { createViewMarkerContribution } from '../../domains/viewports/viewMarkerDrag';
import { useTools, type Contribution, type Tool, type ToolsApi } from '../../tools/overlayBinding';
import { alwaysOn } from '@weasel-js/routing/react';
import { useWithProvidedAmbient } from '../ambientContributions';
import type { SurfaceContribution } from '../surfaceContribution';
import {
  presetActions,
  presetAmbient,
  presetContributions,
  resolveFeatures,
  type EnabledPresets,
  type FeatureBindingOptions,
  type FeaturePreset,
} from './features';
import type { SceneCanvasProps } from './props';
import type { ToolsPatch } from './toolRegistry';
import { useBuiltinTools } from './useBuiltinTools';

type Props = SceneCanvasProps<unknown, string, unknown>;

/** Discriminate the polymorphic `tools` prop: `ToolsApi` has `setActive`
 *  / `active` / `registry`; the patch record shape has none of those. */
export function isToolsApi(tools: ToolsApi | ToolsPatch): tools is ToolsApi {
  return typeof (tools as ToolsApi).setActive === 'function';
}

let nextSerial = 0;
const presetSerials = createPart((_e: object) => nextSerial++);
const entryKey = (e: FeaturePreset): string => {
  // A name from untyped code reaches `resolveFeatures`, which says what to pass instead.
  if (typeof e !== 'object') return String(e);
  return `#${presetSerials(e)}`;
};

/** The presets a canvas runs with. Keyed on the entries, not the array, so
 *  an inline `features={[drawPreset, pathToolsPreset]}` does not re-derive every render. */
export function useEnabledFeatures(
  features: readonly FeaturePreset[] | undefined,
  selectRotates: boolean,
): EnabledPresets {
  const featuresKey = (features ?? []).map(entryKey).join('|');
  return useMemo(
    () => resolveFeatures(features, { selectRotates }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuresKey, selectRotates],
  );
}

/**
 * The canvas's tools: a caller's own `ToolsApi` when the `tools` prop is one
 * (the takeover form), and otherwise the built-ins the presets and
 * `defaultTools` name, patched by a `tools` record.
 */
export function useCanvasTools(args: {
  enabled: EnabledPresets;
  tools: Props['tools'];
  defaultTools: Props['defaultTools'];
  /** `viewport.inertia`, which is the hand tool's. */
  inertia: NonNullable<Props['viewport']>['inertia'];
  ambient: Props['ambient'];
  /** `null` leaves out the kit's default actions, the marker drag among them. */
  actions: Props['actions'];
  /** `longPress.feedback`. Default true, which installs the kit's own. */
  pressFeedback: NonNullable<Props['longPress']>['feedback'];
  defaultActiveTool: Props['defaultActiveTool'];
  modes: Props['modes'];
  onToolsCreated: Props['onToolsCreated'];
  /** Whether an insert of a kind builds a node here: a preset's tool that could insert nothing is left out. */
  insertBuilds?: (kind: string) => boolean;
  /** What the enabled presets' `build`s make on this canvas. */
  built?: { tools: Readonly<Record<string, Tool>>; contributions: readonly SurfaceContribution[] };
}): {
  /** What the canvas routes input through: the takeover, or `internal`. */
  tools: ToolsApi;
  /** The canvas's own api, built whether or not a takeover replaces it. */
  internal: ToolsApi;
  takeover: ToolsApi | null;
  /** Under a takeover, the canvas's own always-on entries whose ids the takeover holds no entry for: they apply
   *  under it as they would without it. Empty with no takeover, where `internal` holds them. */
  surface: readonly SurfaceContribution[];
  /** What the canvas paints: `tools`, plus `surface`'s overlays under a takeover. */
  painted: ToolsApi;
} {
  const { enabled, tools: toolsProp, defaultTools, inertia, defaultActiveTool, modes, onToolsCreated } = args;
  const ambient = useWithProvidedAmbient(args.ambient);

  const takeover = toolsProp && isToolsApi(toolsProp) ? toolsProp : null;
  const registry = useBuiltinTools({
    enabled,
    defaultTools,
    patch: toolsProp && !isToolsApi(toolsProp) ? toolsProp : null,
    inertia,
    insertBuilds: args.insertBuilds,
    offered: args.built?.tools,
  });

  const defaultPressFeedback = useMemo(() => createLongPressFeedbackContribution(), []);
  const feedbackOpt = args.pressFeedback ?? true;
  const pressFeedback = feedbackOpt === true ? defaultPressFeedback : feedbackOpt || null;
  const defaultMarkerDrag = useMemo(() => createViewMarkerContribution(), []);
  const markerDrag = args.actions === null ? null : defaultMarkerDrag;
  const builtContributions = args.built?.contributions;
  const mergedAmbient = useMemo(
    () => [
      ...presetContributions(enabled), ...(builtContributions ?? []),
      ...(ambient ?? []), ...(pressFeedback ? [pressFeedback] : []), ...(markerDrag ? [markerDrag] : []),
    ],
    [enabled, builtContributions, ambient, pressFeedback, markerDrag],
  );

  const internal = useTools({
    active: defaultActiveTool ?? ('select' in registry ? 'select' : null),
    registry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
    ...(modes ? { modes } : {}),
  });
  const tools = takeover ?? internal;
  const surface = useMemo(
    () => (takeover ? mergedAmbient.filter((e) => !takeover.has(e.id)).map(alwaysOn) : []),
    [takeover, mergedAmbient],
  );
  const painted = useMemo(
    () => (takeover ? withSurfaceOverlays(takeover, internal, surface) : internal),
    [takeover, internal, surface],
  );

  const onToolsCreatedRef = useLatest(onToolsCreated);
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools, onToolsCreatedRef]);

  return { tools, internal, takeover, surface, painted };
}

/** `takeover`, drawing `surface`'s overlays after its own. `internal` holds the same entries, so its read gates
 *  them on the active mode exactly as it gates them without a takeover. */
function withSurfaceOverlays(takeover: ToolsApi, internal: ToolsApi, surface: readonly SurfaceContribution[]): ToolsApi {
  const own = new Set(surface.flatMap((entry) => (entry.overlay ? [entry.overlay].flat() : [])));
  if (own.size === 0) return takeover;
  return {
    ...takeover,
    getActiveOverlays: (position) => [
      ...takeover.getActiveOverlays(position),
      ...internal.getActiveOverlays(position).filter((layer) => own.has(layer)),
    ],
  };
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

