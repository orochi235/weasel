/**
 * The canvas side of tool options (`ToolDef.options`): publishing where their
 * values live, and tuning each tool's actions from them.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { deepEqual } from '@weasel-js/registry';
import { useLatest } from '@weasel-js/react';
import { createToolOptionValues, toolOptionParams, type ToolOptionValues } from './toolOptions';
import { useOptionalDepRegistry } from '../interactions/actions/depRegistry';
import type { ActionsRegistry } from '../interactions/actions/registry';
import { tuneToolOptions } from './tuneToolOptions';
import type { Tool } from './types';

/** Publish where the host keeps its tools' option values, as the `toolOptionValues`
 *  dep. Silently does nothing outside a `<DepRegistryProvider>`. */
export function useToolOptionValues(values: ToolOptionValues): void {
  const registry = useOptionalDepRegistry();
  const latest = useLatest(values);
  useEffect(() => registry?.register('toolOptionValues', () => latest.current), [registry, latest]);
}

/** Every option's value for `tool` in `values`, each read from its slot (`toolOptionParams`): what an options row
 *  draws. Re-renders when any of them changes, a shared one set by another tool included, and is the same object
 *  until one does. `null` for no tool, or one with no options. */
export function useToolOptionParams(
  tool: Pick<Tool, 'id' | 'options'> | undefined, values: ToolOptionValues,
): Readonly<Record<string, unknown>> | null {
  const last = useRef<Readonly<Record<string, unknown>> | null>(null);
  const read = useCallback(() => {
    const next = tool?.options ? toolOptionParams(tool.id, tool.options, values) : null;
    if (next === null || last.current === null || !deepEqual(next, last.current)) last.current = next;
    return last.current;
  }, [tool, values]);
  return useSyncExternalStore(values.subscribe, read, read);
}

/** The canvas's `toolOptionValues` dep: `values` (`<SceneCanvas toolOptionValues>`), else a store published beneath
 *  it with {@link useToolOptionValues}, else one held in memory, so a canvas whose host keeps none still has its
 *  tools' options. It sits a rank over sources of its scope, so that order holds whichever mounted first. */
export function useCanvasToolOptionValues(values: ToolOptionValues | undefined): void {
  const registry = useOptionalDepRegistry();
  const [fallback] = useState(createToolOptionValues);
  const latest = useLatest(values);
  useEffect(
    () => registry?.register('toolOptionValues', (below) => latest.current ?? below() ?? fallback, { rank: 1 }),
    [registry, fallback, latest],
  );
}

/** {@link tuneToolOptions} for as long as the component is mounted, following `routed` (`ToolsApi.routed`) when
 *  given. */
export function useToolOptionTunings(
  registry: Pick<ActionsRegistry, 'tune'> | null, tools: Readonly<Record<string, Tool>>, routed?: string | null,
): void {
  const deps = useOptionalDepRegistry();
  const latest = useLatest(routed);
  const follows = routed !== undefined;
  useEffect(
    () => (registry ? tuneToolOptions(registry, deps, Object.values(tools), follows ? () => latest.current ?? null : undefined) : undefined),
    [registry, deps, tools, follows, latest],
  );
}
