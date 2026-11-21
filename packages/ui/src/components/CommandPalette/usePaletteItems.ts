import { useMemo, useState } from 'react';
import { useActionsRegistry, useOptionalDepRegistry } from '@weasel-js/routing/react';
import {
  actionItems,
  createActionDeps,
  eligibleNow,
  checkEnabled,
  matchActionItem,
  type ActionItem,
  type ActionEnabledResult,
  type ActionsRegistry,
} from '@weasel-js/routing';

export interface PaletteItems {
  registry: ActionsRegistry | null;
  /** The entries whose label or a tag contains `query`, in registration order. */
  filtered: readonly ActionItem[];
  enabledOf(item: ActionItem): ActionEnabledResult;
  /** The tag that found `item`, when its label did not. */
  tagOf(item: ActionItem): string | undefined;
}

const ENABLED: ActionEnabledResult = { enabled: true };

const NONE: readonly ActionItem[] = [];

/** The registry's entries and each one's `enabled` state, both read when
 *  `open` turns true, narrowed to `query`. Once closed, the last list stays,
 *  so a dialog fading out still shows what it held. */
export function usePaletteItems(open: boolean, query: string): PaletteItems {
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();

  const [read, setRead] = useState<{ open: boolean; registry: ActionsRegistry | null; items: readonly ActionItem[] }>(
    () => ({ open, registry, items: registry && open ? registry.list().flatMap(actionItems) : NONE }),
  );
  if (open && (!read.open || read.registry !== registry)) {
    setRead({ open, registry, items: registry ? registry.list().flatMap(actionItems) : NONE });
  } else if (!open && read.open) {
    setRead({ ...read, open });
  }
  const allItems = registry ? read.items : NONE;

  const enabledByKey = useMemo<ReadonlyMap<string, ActionEnabledResult>>(() => {
    const m = new Map<string, ActionEnabledResult>();
    const ruleCtx = depReg?.get('ruleCtx');
    for (const item of allItems) {
      if (!eligibleNow(item.action, ruleCtx)) {
        m.set(item.key, { enabled: false });
        continue;
      }
      const deps = depReg ? createActionDeps(item.action, depReg) : undefined;
      m.set(item.key, checkEnabled(item.action, deps, undefined, item.params));
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
    enabledOf: (item) => enabledByKey.get(item.key) ?? ENABLED,
    tagOf: (item) => tags.get(item.key),
  };
}
