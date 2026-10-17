/**
 * The entries an action contributes to a bar, menu or palette — one per
 * variant, or the action itself when it declares none.
 */
import type { IconRef } from '@weasel-js/icons';
import type { Action } from './action';

const NO_TAGS: readonly string[] = Object.freeze([]);

/** One renderable entry: an action, optionally with params. */
export interface ActionItem {
  /** `action.id`, or `action.id:variant.key` — unique across a registry. */
  key: string;
  action: Action;
  label: string;
  icon?: IconRef;
  /** The action's tags, then the variant's own. */
  tags: readonly string[];
  /** What to pass to `trigger(action.id, params)`; absent for a plain action. */
  params?: Readonly<Record<string, unknown>>;
}

/** Expand `action` into the entries a surface renders. An
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

/** How a palette titles `item`: a variant reads as its action's
 *  label and its own ("New: A4"), unless its label already holds the action's
 *  as whole words ("Zoom In", "Reset Zoom"). */
export function actionItemTitle(item: ActionItem): string {
  if (item.key === item.action.id) return item.label;
  const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const head = words(item.action.label);
  const label = words(item.label);
  for (let i = 0; i + head.length <= label.length; i++) {
    if (head.every((w, j) => label[i + j] === w)) return item.label;
  }
  return `${item.action.label}: ${item.label}`;
}
