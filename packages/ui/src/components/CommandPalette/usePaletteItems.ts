import { useMemo } from 'react';
import {
  useActionsRegistry,
  useOptionalDepRegistry,
  actionItems,
  buildDepsFromRequires,
  evaluateEnabled,
  type ActionItem,
  type ActionEnabledResult,
  type ActionsRegistry,
} from '@weasel-js/core';

export interface PaletteItems {
  registry: ActionsRegistry | null;
  /** The entries whose label contains `query`, in registration order. */
  filtered: readonly ActionItem[];
  enabledOf(item: ActionItem): ActionEnabledResult;
}

const ENABLED: ActionEnabledResult = { enabled: true };

/** The registry's entries and each one's `enabled` state, both read when
 *  `open` turns true, narrowed to `query`. */
export function usePaletteItems(open: boolean, query: string): PaletteItems {
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();

  const allItems = useMemo<readonly ActionItem[]>(
    () => (registry && open ? registry.list().flatMap(actionItems) : []),
    [registry, open],
  );

  const enabledById = useMemo<ReadonlyMap<string, ActionEnabledResult>>(() => {
    const m = new Map<string, ActionEnabledResult>();
    for (const { action } of allItems) {
      if (m.has(action.id)) continue;
      const deps = depReg ? buildDepsFromRequires(action, depReg) : undefined;
      m.set(action.id, evaluateEnabled(action, deps));
    }
    return m;
  }, [allItems, depReg]);

  const filtered = useMemo<readonly ActionItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [allItems, query]);

  return { registry, filtered, enabledOf: (item) => enabledById.get(item.action.id) ?? ENABLED };
}
