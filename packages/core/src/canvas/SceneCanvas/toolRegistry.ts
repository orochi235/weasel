import type { AnyTool } from 'tools/overlayBinding';
import type { BaseFeature } from './features';
import { IS_DEV } from './isDev';
import { BUILTIN_TOOL_IDS, type BuiltinToolId } from './props';

/** The patch form of `<SceneCanvas tools>`: per id, `true` mounts that
 *  built-in, `false` leaves it out, and a tool adds or replaces one. */
export type ToolsPatch = Record<string, AnyTool | true | false>;

/** One tool per built-in id, mounted or not. */
export type BuiltinTools = Record<BuiltinToolId, AnyTool>;

export interface ResolveToolRegistryArgs {
  builtins: BuiltinTools;
  /** Built-ins asked for by id. */
  defaultTools?: readonly BuiltinToolId[];
  /** The presets the canvas runs with: `select` brings the select tool and
   *  `view` the hand. */
  enabled: ReadonlySet<BaseFeature>;
  patch: ToolsPatch | null;
  /** Whether to warn about a patch entry that is probably a mistake. */
  dev?: boolean;
}

/**
 * The tool registry a canvas mounts when it is not handed a whole `ToolsApi`.
 *
 * Built-ins come first, in `BUILTIN_TOOL_IDS` order whatever order they were
 * asked for in; a patch tool replaces a mounted one where it stands, and any
 * other is appended in patch order. That order is the palette's.
 */
export function resolveToolRegistry(args: ResolveToolRegistryArgs): Record<string, AnyTool> {
  const { builtins, defaultTools = [], enabled, patch, dev = IS_DEV } = args;
  const registry: Record<string, AnyTool> = {};
  for (const id of BUILTIN_TOOL_IDS) {
    const patched = patch?.[id];
    if (patched === false) continue;
    const asked = patched === true
      || defaultTools.includes(id)
      || (id === 'select' && enabled.has('select'))
      || (id === 'hand' && enabled.has('view'));
    if (asked) registry[id] = builtins[id];
  }
  for (const [id, value] of Object.entries(patch ?? {})) {
    if (value === false) continue;
    if (value === true) {
      if (dev && !(BUILTIN_TOOL_IDS as readonly string[]).includes(id)) {
        console.warn(`[SceneCanvas] tools.${id}=true is not a known built-in id; ignoring`);
      }
      continue;
    }
    if (dev && id in registry) {
      console.warn(`[SceneCanvas] tools prop overrides bundled "${id}" tool`);
    }
    registry[id] = value;
  }
  return registry;
}
