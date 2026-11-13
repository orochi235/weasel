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
  const last = useRef<ToolShortcuts>(NONE);
  const read = useCallback((): ToolShortcuts => {
    const next = registry ? toolShortcutsOf(registry.list(), Object.keys(tools)) : declaredToolShortcuts(tools);
    if (!deepEqual(next, last.current)) last.current = next;
    return last.current;
  }, [registry, tools]);
  return useSyncExternalStore(registry ? registry.subscribe : noSubscribe, read, read);
}
