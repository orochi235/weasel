import type { Contribution, Tool } from '../../tools/overlayBinding';
import type { EnabledPresets, FeatureBindingOptions, PresetSource } from './features';
import type { SceneCanvasProps } from './props';
import { useCanvasTools, useFeatureBindings } from './useCanvasTools';

type Props = SceneCanvasProps<unknown, string, unknown>;

/** The `<SceneCanvas>` props its tools and preset bindings read. */
export type SceneCanvasToolProps = Pick<
  Props,
  | 'tools' | 'defaultTools' | 'toolOptions' | 'viewport' | 'ambient' | 'longPress'
  | 'initialActiveTool' | 'modes' | 'onToolsCreated' | 'selectTool' | 'actions'
>;

/** The canvas's tools, and the contributions and standard actions its presets bring. */
export function useSceneCanvasTools(args: {
  props: SceneCanvasToolProps;
  select: Tool;
  /** The select tool's move options, which the selection's `move` binding takes. */
  move: unknown;
  enabled: EnabledPresets;
  presetSource: PresetSource;
  /** Entering and leaving groups, installed with the `select` preset. */
  groupEntry: Contribution;
}) {
  const { props, select, enabled } = args;
  const { tools, internal, takeover } = useCanvasTools({
    select,
    groupEntry: enabled.has('select') ? args.groupEntry : null,
    enabled,
    tools: props.tools,
    defaultTools: props.defaultTools,
    toolOptions: props.toolOptions,
    inertia: props.viewport?.inertia,
    ambient: props.ambient,
    actions: props.actions,
    pressFeedback: props.longPress?.feedback,
    initialActiveTool: props.initialActiveTool,
    modes: props.modes,
    onToolsCreated: props.onToolsCreated,
  });
  const { contributions, standardActions } = useFeatureBindings({
    enabled, pool: args.presetSource.pool, baseline: args.presetSource.baseline,
    tools,
    move: args.move as FeatureBindingOptions['move'],
    rotate: (props.selectTool?.rotate || undefined) as FeatureBindingOptions['rotate'],
  });
  return { tools, internal, takeover, contributions, standardActions };
}
