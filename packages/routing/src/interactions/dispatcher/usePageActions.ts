import { useEffect, useState } from 'react';
import type { Action } from '../actions/action';
import { ActionsNode } from '../actions/ActionsProvider';
import { createDepRegistry } from '../actions/depNode';
import type { UseGestureDispatcherOptions } from './gestureDispatcherOptions';
import { type DispatcherTools, useDispatcherIn } from './useGestureDispatcher';

const NO_ELEMENT = { current: null };
const NO_ENTRIES: UseGestureDispatcherOptions['entriesById'] = new Map();
const KEYS_ONLY = { contextMenu: false, ingest: false } as const;
const NO_TOOL: DispatcherTools = { active: null, hotkeyStack: [] };

/**
 * Bind `actions`' keys on the page, with no provider above: for a hook or a page that has no actions registry to
 * put them on. They are heard as `keyboard: 'page'` hears them, after a focused widget's own handlers and ahead of
 * every dispatcher on `window`, and an action that is not enabled leaves its key to the rest. `actions` is
 * registered again whenever it changes identity, so memoize it.
 */
export function usePageActions(actions: readonly Action[], enabled = true): void {
  const [depRegistry] = useState(createDepRegistry);
  const [node] = useState(() => new ActionsNode(null, true, () => depRegistry));
  useEffect(() => {
    const offs = actions.map((a) => node.registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [node, actions]);
  useDispatcherIn(
    {
      canvasRef: NO_ELEMENT,
      actions: node.registry,
      entriesById: NO_ENTRIES,
      channels: KEYS_ONLY,
      keyboard: 'page',
      hears: 'own',
      enabled,
    },
    NO_TOOL,
    depRegistry,
  );
}
