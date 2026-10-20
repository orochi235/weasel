import type { InertiaConfig } from 'core/viewport/useDecayLoop';
import type { NodeId, Scene } from 'core/scene/types';
import { useHandTool } from 'tools/builtin/hand';
import { useSliceTool } from 'tools/builtin/slice';
import type { Tool } from 'tools/overlayBinding';
import type { EnabledPresets } from './features';
import type { BuiltinToolId } from './props';
import type { ToolEntry } from '@weasel-js/routing';
import { resolveToolRegistry, type ToolsPatch } from './toolRegistry';
import { useBuiltinRigTools } from './useBuiltinRigTools';
import { useBuiltinShapeTools, type BuiltinToolOptions } from './useBuiltinShapeTools';

export interface UseBuiltinToolsArgs {
  /** The canvas's select tool, which is built from its scene and pickers. */
  select: Tool;
  /** The canvas's scene, which the rig tools edit. */
  scene: Scene<unknown, string, unknown>;
  /** The canvas's selection, which names the rig the rig tools edit. */
  selection: () => readonly NodeId[];
  enabled: EnabledPresets;
  defaultTools?: readonly ToolEntry<BuiltinToolId>[];
  patch: ToolsPatch | null;
  toolOptions?: BuiltinToolOptions;
  /** `viewport.inertia`, which is the hand tool's. */
  inertia?: boolean | InertiaConfig;
}

/** The registry of tools `<SceneCanvas>` mounts for itself. Every built-in's
 *  hook runs on every render; `resolveToolRegistry` decides which are in. */
export function useBuiltinTools(args: UseBuiltinToolsArgs): Record<string, Tool> {
  const { select, scene, selection, enabled, defaultTools, patch, toolOptions, inertia } = args;
  const hand = useHandTool({ inertia });
  const shapes = useBuiltinShapeTools({ options: toolOptions });
  const slice = useSliceTool(toolOptions?.slice);
  const rig = useBuiltinRigTools({ scene, selection, options: toolOptions });
  return resolveToolRegistry({
    builtins: { select, hand, ...shapes, slice, ...rig },
    defaultTools,
    enabled,
    patch,
  });
}
