import type { InertiaConfig } from 'core/viewport/useDecayLoop';
import { useHandTool } from 'tools/builtin/hand';
import type { Tool } from 'tools/overlayBinding';
import type { EnabledPresets } from './features';
import type { BuiltinToolId } from './props';
import { resolveToolRegistry, type ToolsPatch } from './toolRegistry';
import { useBuiltinShapeTools, type BuiltinToolOptions } from './useBuiltinShapeTools';

export interface UseBuiltinToolsArgs {
  /** The canvas's select tool, which is built from its scene and pickers. */
  select: Tool;
  enabled: EnabledPresets;
  defaultTools?: readonly BuiltinToolId[];
  patch: ToolsPatch | null;
  toolOptions?: BuiltinToolOptions;
  /** `viewport.inertia`, which is the hand tool's. */
  inertia?: boolean | InertiaConfig;
}

/** The registry of tools `<SceneCanvas>` mounts for itself. Every built-in's
 *  hook runs on every render; `resolveToolRegistry` decides which are in. */
export function useBuiltinTools(args: UseBuiltinToolsArgs): Record<string, Tool> {
  const { select, enabled, defaultTools, patch, toolOptions, inertia } = args;
  const hand = useHandTool({ inertia });
  const shapes = useBuiltinShapeTools({ options: toolOptions });
  return resolveToolRegistry({
    builtins: { select, hand, ...shapes },
    defaultTools,
    enabled,
    patch,
  });
}
