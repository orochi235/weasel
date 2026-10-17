/**
 * @experimental
 * The entries an action contributes to a bar, menu or palette — one per
 * variant, or the action itself when it declares none.
 */
import type { ReactNode } from 'react';
import type { Action } from './action';

const NO_TAGS: readonly string[] = Object.freeze([]);

/** @experimental One renderable entry: an action, optionally with params. */
export interface ActionItem {
  /** `action.id`, or `action.id:variant.key` — unique across a registry. */
  key: string;
  action: Action;
  label: string;
  icon?: ReactNode | (() => ReactNode);
  /** The action's tags, then the variant's own. */
  tags: readonly string[];
  /** What to pass to `trigger(action.id, params)`; absent for a plain action. */
  params?: Readonly<Record<string, unknown>>;
}

/** @experimental Expand `action` into the entries a surface renders. An
 *  action without an immediate invoker has none: `trigger` cannot start a
 *  drag, so a button for one would do nothing. */
export function actionItems(action: Action): ActionItem[] {
  if (action.invoker?.timing !== 'immediate') return [];
  if (!action.variants?.length) {
    return [{ key: action.id, action, label: action.label, icon: action.icon, tags: action.tags ?? NO_TAGS }];
  }
  return action.variants.map((v) => ({
    key: `${action.id}:${v.key}`,
    action,
    label: v.label,
    icon: v.icon ?? action.icon,
    tags: v.tags ? [...(action.tags ?? NO_TAGS), ...v.tags] : action.tags ?? NO_TAGS,
    params: v.params,
  }));
}

/** @experimental How a palette titles `item`: a variant reads as its action's
 *  label and its own ("New: A4"), unless its label already opens with the
 *  action's as a whole word ("Zoom In"). */
export function actionItemTitle(item: ActionItem): string {
  if (item.key === item.action.id) return item.label;
  const head = item.action.label.toLowerCase();
  const label = item.label.toLowerCase();
  const next = label.charAt(head.length);
  if (label.startsWith(head) && !/[\p{L}\p{N}]/u.test(next)) return item.label;
  return `${item.action.label}: ${item.label}`;
}
