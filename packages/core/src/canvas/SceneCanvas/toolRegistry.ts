import type { Tool } from 'tools/overlayBinding';
import { presetBuiltinTools, presetOwnTools, type EnabledPresets } from './features';
import { isDev } from '@weasel-js/react';
import { toolIdsOf, type GestureBinding, type ToolEntry } from '@weasel-js/routing';
import { BUILTIN_TOOL_IDS, type BuiltinToolId } from './props';
import { setOwn } from '@weasel-js/registry';

const warnedUnbuildable = new WeakSet<Tool>();

/** The patch form of `<SceneCanvas tools>`: per id, `true` mounts that
 *  built-in, `false` leaves it out, and a tool adds or replaces one. */
export type ToolsPatch = Record<string, Tool | true | false>;

/** One tool per built-in id, mounted or not. */
export type BuiltinTools = Record<BuiltinToolId, Tool>;

export interface ResolveToolRegistryArgs {
  builtins: BuiltinTools;
  /** Built-ins asked for, by id or by set. */
  defaultTools?: readonly ToolEntry<BuiltinToolId>[];
  /** The presets the canvas runs with, each bringing the tools it names. */
  enabled: EnabledPresets;
  patch: ToolsPatch | null;
  /** Whether an insert of a kind builds a node on the canvas. Given, a preset's own tool whose
   *  every `insert` binding names a kind nothing builds is left out, so it cannot be chosen. */
  insertBuilds?: (kind: string) => boolean;
  /** Whether to warn about a patch entry that is probably a mistake. */
  dev?: boolean;
}

/**
 * The tool registry a canvas mounts when it is not handed a whole `ToolsApi`.
 *
 * Built-ins come first, in `BUILTIN_TOOL_IDS` order whatever order they were
 * asked for in, then the presets' own tools in preset order; a patch tool
 * replaces a mounted one where it stands, and any other is appended in patch
 * order. A palette keeps that order for tools its own order does not name.
 * Replacing a tool that is mounted only because a preset implies it is the
 * documented way to restyle it, so only a patch tool for an id `defaultTools`
 * also names is warned about.
 */
export function resolveToolRegistry(args: ResolveToolRegistryArgs): Record<string, Tool> {
  const { builtins, enabled, patch, dev = isDev() } = args;
  const defaultTools = toolIdsOf(args.defaultTools ?? []);
  const registry: Record<string, Tool> = {};
  const preset = presetBuiltinTools(enabled);
  for (const id of BUILTIN_TOOL_IDS) {
    const patched = patch?.[id];
    if (patched === false) continue;
    const asked = patched === true || defaultTools.includes(id) || preset.has(id);
    if (asked) setOwn(registry, id, builtins[id]);
  }
  for (const [id, tool] of Object.entries(presetOwnTools(enabled))) {
    if (patch?.[id] === false) continue;
    if (args.insertBuilds && insertsNothing(tool, args.insertBuilds)) {
      if (dev && !warnedUnbuildable.has(tool)) {
        warnedUnbuildable.add(tool);
        console.warn(`[SceneCanvas] tool "${id}" is left out: no insert factory on this canvas builds the kind it inserts`);
      }
      continue;
    }
    setOwn(registry, id, tool);
  }
  for (const [id, value] of Object.entries(patch ?? {})) {
    if (value === false) continue;
    if (value === true) {
      if (dev && !(BUILTIN_TOOL_IDS as readonly string[]).includes(id)) {
        console.warn(`[SceneCanvas] tools.${id}=true is not a known built-in id; ignoring`);
      }
      continue;
    }
    if (dev && Object.hasOwn(registry, id) && (defaultTools as string[]).includes(id)) {
      console.warn(`[SceneCanvas] tools prop overrides bundled "${id}" tool`);
    }
    setOwn(registry, id, value);
  }
  return registry;
}

/**
 * Whether `tool` binds `insert` only to kinds nothing on the canvas builds, so choosing it
 * could insert nothing. A binding whose params are a thunk, or name no kind, could build
 * anything and keeps the tool.
 */
export function insertsNothing(tool: Tool, builds: (kind: string) => boolean): boolean {
  const inserts = (tool.bindings ?? []).filter((b: GestureBinding) => b.actionId === 'insert');
  if (inserts.length === 0) return false;
  return inserts.every((b) => {
    const params = b.opts?.params;
    const kind = typeof params === 'object' && params !== null ? (params as { kind?: unknown }).kind : undefined;
    return typeof kind === 'string' && !builds(kind);
  });
}
