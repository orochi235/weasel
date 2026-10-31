/**
 * The canvas side of tool options (`ToolDef.options`): publishing where their
 * values live, and tuning each tool's action from them.
 */
import { useEffect } from 'react';
import { toolOptionParams, type ToolOptions, type ToolOptionValues } from '@weasel-js/routing';
import { useDepSource, useOptionalDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { ActionsRegistry } from '@weasel-js/routing';
import type { Tool } from './overlayBinding';

/** Publish where the host keeps its tools' option values, as the `toolOptionValues`
 *  dep. Silently does nothing outside a `<DepRegistryProvider>`. */
export function useToolOptionValues(values: ToolOptionValues): void {
  useDepSource('toolOptionValues', () => values);
}

function heldOptions(toolId: string, options: ToolOptions, values: ToolOptionValues | undefined): Record<string, number> {
  const held = values?.get(toolId) ?? {};
  const out: Record<string, number> = {};
  for (const key of Object.keys(options.prefs.children)) if (typeof held[key] === 'number') out[key] = held[key];
  return out;
}

/** Write each of `toolId`'s options that `params` sets to a new value into `values`. */
function keepOptions(toolId: string, options: ToolOptions, values: ToolOptionValues | undefined, params: Readonly<Record<string, unknown>>): void {
  if (!values) return;
  const now = toolOptionParams(toolId, options, values);
  for (const key of Object.keys(options.prefs.children)) {
    const v = params[key];
    if (typeof v === 'number' && Number.isFinite(v) && v !== now[key]) values.set(toolId, key, v);
  }
}

/** Tune each tool's options action with the values the `toolOptionValues` dep
 *  holds, read on every invocation: only those it holds, so an option it does
 *  not leaves the action's own default, or another tuning's value, in place.
 *  The options and the action's last-operation panel are one setting: a value
 *  the panel sets is written back to the dep. Returns a release. */
export function tuneToolOptions(
  registry: Pick<ActionsRegistry, 'tune'>,
  deps: Pick<DepRegistry, 'get'> | null,
  tools: Iterable<Tool>,
): () => void {
  const releases: Array<() => void> = [];
  for (const tool of tools) {
    const options = tool.options;
    if (!options) continue;
    releases.push(registry.tune(options.actionId, {
      params: () => heldOptions(tool.id, options, deps?.get('toolOptionValues')),
      keep: (params) => keepOptions(tool.id, options, deps?.get('toolOptionValues'), params),
    }));
  }
  return () => { for (const r of releases) r(); };
}

/** {@link tuneToolOptions} for as long as the component is mounted. */
export function useToolOptionTunings(registry: Pick<ActionsRegistry, 'tune'> | null, tools: Readonly<Record<string, Tool>>): void {
  const deps = useOptionalDepRegistry();
  useEffect(() => (registry ? tuneToolOptions(registry, deps, Object.values(tools)) : undefined), [registry, deps, tools]);
}
