import { useCallback, useRef, useSyncExternalStore } from 'react';
import { deepEqual } from '@weasel-js/registry';
import type { ActionsRegistry } from '../interactions/actions/registry';
import type { AnyTool } from './types';
import { declaredToolShortcuts, toolShortcutsOf, type ToolShortcuts } from './toolShortcuts';

const NONE: ToolShortcuts = Object.freeze({});
const noSubscribe = () => () => {};

/**
 * {@link ToolsApi.shortcuts}: the keys `registry`'s `tool.activate` binds to
 * each of `tools`, kept current as bindings change and kept by identity while
 * they read the same. With no registry in scope, the keys the tools declare.
 */
export function useToolShortcuts(
  registry: ActionsRegistry | null,
  tools: Readonly<Record<string, AnyTool>>,
): ToolShortcuts {
  // The last few answers, so a value the keys pass through and return from (a tool's keys unregistered and registered
  // again in one effect) comes back as the object it was, and nothing holding the api re-runs for it.
  const recent = useRef<ToolShortcuts[]>([NONE]);
  const read = useCallback((): ToolShortcuts => {
    const next = registry ? toolShortcutsOf(registry.list(), Object.keys(tools)) : declaredToolShortcuts(tools);
    const known = recent.current.find((r) => deepEqual(r, next));
    if (known) return known;
    recent.current = [next, ...recent.current].slice(0, 4);
    return next;
  }, [registry, tools]);
  return useSyncExternalStore(registry ? registry.subscribe : noSubscribe, read, read);
}
