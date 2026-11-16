import type { InertiaOptions } from 'core/viewport/useDecayLoop';
import { useHandTool } from 'tools/builtin/hand';
import type { Tool } from 'tools/overlayBinding';
import type { EnabledPresets } from './features';
import type { ToolEntry } from '@weasel-js/routing';
import { resolveToolRegistry, type ToolsPatch } from './toolRegistry';

export interface UseBuiltinToolsArgs {
  /** The canvas's select tool, which is built from its scene and pickers. */
  select: Tool;
  enabled: EnabledPresets;
  defaultTools?: readonly ToolEntry<string>[];
  patch: ToolsPatch | null;
  /** `viewport.inertia`, which is the hand tool's. */
  inertia?: boolean | InertiaOptions;
  insertBuilds?: (kind: string) => boolean;
  /** Tools the enabled presets' `build`s offer by id. */
  offered?: Readonly<Record<string, Tool>>;
}

/** The registry of tools `<SceneCanvas>` mounts for itself. Every built-in's
 *  hook runs on every render; `resolveToolRegistry` decides which are in. */
export function useBuiltinTools(args: UseBuiltinToolsArgs): Record<string, Tool> {
  const { select, enabled, defaultTools, patch, inertia, insertBuilds, offered } = args;
  const hand = useHandTool({ inertia });
  return resolveToolRegistry({
    builtins: { select, hand },
    offered,
    defaultTools,
    enabled,
    patch,
    insertBuilds,
  });
}
