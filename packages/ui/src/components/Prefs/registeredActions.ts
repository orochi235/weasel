import { useSyncExternalStore } from 'react';
import { actionItems, useActionsRegistry, type Action, type ActionItem } from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import { resolveOrder, type PrefAction, type PrefActions, type PrefLeaf } from '@weasel-js/prefs';

const NONE: readonly Action[] = Object.freeze([]);
const noSubscribe = (): (() => void) => () => {};
const none = (): readonly Action[] => NONE;

/** Every action the `ActionsRegistry` above holds, in registry order, kept current. Empty with no registry. */
export function useRegisteredActions(): readonly Action[] {
  const registry = useActionsRegistry();
  return useSyncExternalStore(
    registry ? registry.subscribe : noSubscribe,
    registry ? registry.list : none,
    registry ? registry.list : none,
  );
}

/** What a surface may change about the entries an `actions` leaf draws. */
export interface ActionsLeafOptions {
  /** The entries to draw, in place of the leaf's group's. */
  pick?: (all: readonly Action[]) => readonly ActionItem[];
  /** Only these of them, each an action id — every variant of it — or an `id:variant` key. */
  only?: readonly string[];
  /** Glyph names by entry key, over each action's own icon. */
  icons?: Readonly<Record<string, IconRef>>;
  /** Labels by entry key, over each action's own label. */
  labels?: Readonly<Record<string, string>>;
}

/**
 * An `actions` leaf as the `action` leaves it stands for: one per entry of its
 * group, in registry order, a parametric action once per variant. Each names
 * the entry by key and nothing else, so it shows the registered label and icon.
 */
export function actionsLeafActions(
  leaf: PrefActions,
  all: readonly Action[],
  { pick, only, icons, labels }: ActionsLeafOptions = {},
): PrefAction[] {
  const picked = pick ? pick(all) : all.filter((a) => a.group === leaf.group).flatMap(actionItems);
  const byKey = new Map<string, ActionItem[]>();
  for (const item of picked) {
    const copies = byKey.get(item.key);
    if (copies) copies.push(item);
    else byKey.set(item.key, [item]);
  }
  const items = leaf.order ? resolveOrder([...byKey.keys()], leaf.order, 'end').flatMap((key) => byKey.get(key)!) : picked;
  return items
    .filter((item) => !only || only.includes(item.key) || only.includes(item.action.id))
    .map((item) => {
      const icon = icons?.[item.key];
      return {
        kind: 'action',
        // Empty, the button reads the registered action's own label.
        name: labels?.[item.key] ?? '',
        description: '',
        default: undefined,
        action: item.key,
        ...(icon === undefined ? {} : { icon }),
      };
    });
}

/**
 * An `action` leaf naming a parametric action by its bare id, as one leaf per
 * variant, the way a menu draws it; `null` for a leaf that names one entry.
 * Each variant leaf names its entry by key and nothing else, so it shows the
 * variant's own label and icon.
 */
export function actionLeafVariants(leaf: PrefAction, all: readonly Action[]): PrefAction[] | null {
  const action = leaf.action === undefined ? undefined : all.find((a) => a.id === leaf.action);
  if (!action?.variants?.length) return null;
  return actionItems(action).map((item) => {
    const { label: _label, icon: _icon, ...rest } = leaf;
    return { ...rest, name: '', action: item.key };
  });
}

/** True for a leaf a panel draws as action buttons that carry their own words, in place of a labeled row. */
export function prefDrawsActionRow(leaf: PrefLeaf): boolean {
  return (leaf.kind === 'action' && (leaf as PrefAction).control !== 'icon') || leaf.kind === 'actions';
}
