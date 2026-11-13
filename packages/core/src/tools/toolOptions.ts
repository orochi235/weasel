/**
 * The canvas side of tool options (`ToolDef.options`): publishing where their
 * values live, and tuning each tool's actions from them.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { deepEqual } from '@weasel-js/registry';
import { createToolOptionValues, keepToolOptions, toolOptionActionIds, toolOptionParams, type ToolOptionValues } from '@weasel-js/routing';
import { useDepSource, useOptionalDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { ActionsRegistry } from '@weasel-js/routing';
import type { Tool } from './overlayBinding';

/** Publish where the host keeps its tools' option values, as the `toolOptionValues`
 *  dep. Silently does nothing outside a `<DepRegistryProvider>`. */
export function useToolOptionValues(values: ToolOptionValues): void {
  useDepSource('toolOptionValues', () => values);
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

/** Hold tool option values in memory under whatever store the host publishes, so a canvas whose host keeps none
 *  still has its tools' options: the store the host publishes, else this one. */
export function useFallbackToolOptionValues(): void {
  const registry = useOptionalDepRegistry();
  const [fallback] = useState(createToolOptionValues);
  useEffect(() => registry?.register('toolOptionValues', (below) => below() ?? fallback), [registry, fallback]);
}

/** Tune the actions each tool's options are params of with every option's
 *  value, from the `toolOptionValues` dep or its default, while that tool is
 *  the live one (the newest held on its key, else the active one), read on every invocation. The tuning lies under every other
 *  (`ActionTuning.under`), so a host's own tuning of a param still wins. A
 *  tool's bindings name none of its options. Several tools
 *  can bind one action (every shape tool binds `insert`), and only the active
 *  tool's options reach it. The options and the action's last-operation panel
 *  are one setting: a value the panel sets is written back to the dep, for the
 *  tool whose options the action last read, active or not.
 *  Returns a release. */
export function tuneToolOptions(
  registry: Pick<ActionsRegistry, 'tune'>,
  deps: Pick<DepRegistry, 'get'> | null,
  tools: Iterable<Tool>,
): () => void {
  const releases: Array<() => void> = [];
  // The tool whose options each action last read: the one a panel change to its last run belongs to.
  const readBy = new Map<string, string>();
  const all = [...tools];
  const ids = new Set(all.map((t) => t.id));
  // The newest of these tools held on its key, else the active one, as routing walks them.
  const live = (): string | null => {
    const slot = deps?.get('activeTool');
    const stack = slot?.hotkeyStack ?? [];
    for (let i = stack.length - 1; i >= 0; i--) if (ids.has(stack[i]!)) return stack[i]!;
    return slot?.active ?? null;
  };
  for (const tool of all) {
    const options = tool.options;
    if (!options) continue;
    const active = () => live() === tool.id;
    for (const actionId of toolOptionActionIds(options)) {
      releases.push(registry.tune(actionId, {
        under: true,
        params: () => {
          if (!active()) return {};
          readBy.set(actionId, tool.id);
          return toolOptionParams(tool.id, options, deps?.get('toolOptionValues'));
        },
        keep: (params) => {
          const values = deps?.get('toolOptionValues');
          if (values && (readBy.get(actionId) ?? (active() ? tool.id : null)) === tool.id) keepToolOptions(tool.id, options, values, params);
        },
      }));
    }
  }
  return () => { for (const r of releases) r(); };
}

/** {@link tuneToolOptions} for as long as the component is mounted. */
export function useToolOptionTunings(registry: Pick<ActionsRegistry, 'tune'> | null, tools: Readonly<Record<string, Tool>>): void {
  const deps = useOptionalDepRegistry();
  useEffect(() => (registry ? tuneToolOptions(registry, deps, Object.values(tools)) : undefined), [registry, deps, tools]);
}
