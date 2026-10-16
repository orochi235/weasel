import { useMemo } from 'react';
import {
  useActionsRegistry,
  useOptionalDepRegistry,
  actionItems,
  buildDepsFromRequires,
  evaluateEnabled,
  matchActionItem,
  type ActionItem,
  type ActionEnabledResult,
  type ActionsRegistry,
} from '@weasel-js/core';

export interface PaletteItems {
  registry: ActionsRegistry | null;
  /** The entries whose label or a tag contains `query`, in registration order. */
  filtered: readonly ActionItem[];
  enabledOf(item: ActionItem): ActionEnabledResult;
  /** The tag that found `item`, when its label did not. */
  tagOf(item: ActionItem): string | undefined;
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

  const { filtered, tags } = useMemo(() => {
    const byTag = new Map<string, string>();
    const kept = allItems.filter((i) => {
      const hit = matchActionItem(i, query);
      if (hit?.by === 'tag') byTag.set(i.key, hit.tag);
      return hit !== null;
    });
    return { filtered: kept, tags: byTag };
  }, [allItems, query]);

  return {
    registry,
    filtered,
    enabledOf: (item) => enabledById.get(item.action.id) ?? ENABLED,
    tagOf: (item) => tags.get(item.key),
  };
}
