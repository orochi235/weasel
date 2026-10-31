/**
 * The canvas side of tool options (`ToolDef.options`): publishing where their
 * values live, and tuning each tool's action from them.
 */
import { useEffect } from 'react';
import { toolOptionParams, type ToolOptionValues } from '@weasel-js/routing';
import { useDepSource, useOptionalDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { ActionsRegistry } from '@weasel-js/routing';
import type { Tool } from './overlayBinding';

/** Publish where the host keeps its tools' option values, as the `toolOptionValues`
 *  dep. Silently does nothing outside a `<DepRegistryProvider>`. */
export function useToolOptionValues(values: ToolOptionValues): void {
  useDepSource('toolOptionValues', () => values);
}

/** Tune each tool's options action with the values the `toolOptionValues` dep
 *  holds, read on every invocation. Returns a release. */
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
      params: () => toolOptionParams(tool.id, options, deps?.get('toolOptionValues')),
    }));
  }
  return () => { for (const r of releases) r(); };
}

/** {@link tuneToolOptions} for as long as the component is mounted. */
export function useToolOptionTunings(registry: Pick<ActionsRegistry, 'tune'> | null, tools: Readonly<Record<string, Tool>>): void {
  const deps = useOptionalDepRegistry();
  useEffect(() => (registry ? tuneToolOptions(registry, deps, Object.values(tools)) : undefined), [registry, deps, tools]);
}
