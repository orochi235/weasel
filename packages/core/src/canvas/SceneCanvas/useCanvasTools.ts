import { useEffect, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import { createLongPressFeedbackContribution } from '../../features/longPress/longPressFeedback';
import { useTools, type Contribution, type Tool, type ToolsApi } from '../../tools/overlayBinding';
import {
  featureActionIds,
  featureAmbient,
  resolveFeatures,
  type BaseFeature,
  type Feature,
  type FeatureBindingOptions,
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

/** The presets a canvas runs with. Keyed on the ids, not the array, so an
 *  inline `features={['draw']}` does not re-derive every render. */
export function useEnabledFeatures(
  features: readonly Feature[] | undefined,
  hasViewport: boolean,
): ReadonlySet<BaseFeature> {
  const featuresKey = (features ?? []).join('|');
  return useMemo(
    () => resolveFeatures(features, { viewport: hasViewport }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuresKey, hasViewport],
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
  enabled: ReadonlySet<BaseFeature>;
  tools: Props['tools'];
  defaultTools: Props['defaultTools'];
  toolOptions: Props['toolOptions'];
  /** `viewport.inertia`, which is the hand tool's. */
  inertia: NonNullable<Props['viewport']>['inertia'];
  ambient: Props['ambient'];
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
  const mergedAmbient = useMemo(
    () => (pressFeedback ? [...(ambient ?? []), pressFeedback] : (ambient ?? [])),
    [ambient, pressFeedback],
  );

  const internal = useTools({
    active: initialActiveTool ?? ('select' in registry ? 'select' : null),
    registry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
    ...(modes ? { modes } : {}),
  });
  const tools = takeover ?? internal;

  const onToolsCreatedRef = useLatest(onToolsCreated);
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools, onToolsCreatedRef]);

  return { tools, internal, takeover };
}

/**
 * The presets' ambient bindings, and the kit-standard actions the canvas
 * leaves unregistered. The bindings are not tools and sit outside `tools`, so
 * they apply under a takeover too. An action is registered when a preset
 * names it or a tool or contribution on this canvas binds it: a tool brings
 * the actions it routes to, so `defaultTools={['rect']}` works under any preset.
 */
export function useFeatureBindings(args: {
  enabled: ReadonlySet<BaseFeature>;
  tools: Pick<ToolsApi, 'registry' | 'ambient'>;
  move: FeatureBindingOptions['move'];
  rotate: FeatureBindingOptions['rotate'];
}): { contributions: Contribution[]; standardActionsExclude: string[] } {
  const { enabled, tools, move, rotate } = args;
  const contributions = useMemo<Contribution[]>(
    () => featureAmbient(enabled, { move, rotate }),
    [enabled, move, rotate],
  );
  const standardActionsExclude = useMemo(() => {
    const include = featureActionIds(enabled);
    const bound = [...Object.values(tools.registry), ...tools.ambient, ...contributions];
    for (const entry of bound) {
      for (const b of entry.bindings ?? []) include.add(b.actionId);
    }
    return KIT_STANDARD_ACTION_IDS.filter((id) => !include.has(id));
  }, [enabled, tools, contributions]);
  return { contributions, standardActionsExclude };
}
