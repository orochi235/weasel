import type { Contribution, Tool } from '../../tools/overlayBinding';
import { usePresetBuilds, type PresetBuildSource } from './presetBuild';
import type { EnabledPresets, FeatureBindingOptions } from './features';
import { BASELINE_ACTIONS } from './presets/baseline';
import { builtinToolActions } from './presets/toolDriven';
import type { SceneCanvasProps } from './props';
import { useCanvasTools, useFeatureBindings } from './useCanvasTools';
import { usePublishTools } from '../../tools/toolsScope';

type Props = SceneCanvasProps<unknown, string, unknown>;

/** The `<SceneCanvas>` props its tools and preset bindings read. */
export type SceneCanvasToolProps = Pick<
  Props,
  | 'tools' | 'defaultTools' | 'toolOptions' | 'viewport' | 'ambient' | 'longPress'
  | 'defaultActiveTool' | 'modes' | 'onToolsCreated' | 'selectTool' | 'actions'
>;

/** The canvas's tools, published to its scope for `useScopedTools`, and the contributions and standard actions its
 *  presets bring. */
export function useSceneCanvasTools(args: {
  props: SceneCanvasToolProps;
  select: Tool;
  /** The select tool's move options, which the selection's `move` binding takes. */
  move: unknown;
  enabled: EnabledPresets;
  /** Entering and leaving groups, installed with the `select` preset. */
  groupEntry: Contribution;
  /** Whether an insert of a kind builds a node on this canvas. */
  insertBuilds?: (kind: string) => boolean;
  /** What the enabled presets' `build`s are handed, less `toolOptions`, which is the prop's. */
  build: Omit<PresetBuildSource, 'toolOptions'>;
}) {
  const { props, select, enabled } = args;
  const built = usePresetBuilds(enabled.builds, { ...args.build, toolOptions: props.toolOptions });
  const { tools, internal, takeover, surface } = useCanvasTools({
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
    defaultActiveTool: props.defaultActiveTool,
    modes: props.modes,
    onToolsCreated: props.onToolsCreated,
    insertBuilds: args.insertBuilds,
    built,
  });
  usePublishTools(tools);
  const { contributions, standardActions } = useFeatureBindings({
    enabled, pool: builtinToolActions, baseline: BASELINE_ACTIONS,
    tools,
    surface,
    move: args.move as FeatureBindingOptions['move'],
    rotate: (props.selectTool?.rotate || undefined) as FeatureBindingOptions['rotate'],
  });
  return { tools, internal, takeover, surface, contributions, standardActions };
}
