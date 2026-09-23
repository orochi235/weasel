/**
 * @experimental
 * The entries an action contributes to a bar, menu or palette — one per
 * variant, or the action itself when it declares none.
 */
import type { ReactNode } from 'react';
import type { Action } from './action';

/** @experimental One renderable entry: an action, optionally with params. */
export interface ActionItem {
  /** `action.id`, or `action.id:variant.key` — unique across a registry. */
  key: string;
  action: Action;
  label: string;
  icon?: ReactNode | (() => ReactNode);
  /** What to pass to `trigger(action.id, params)`; absent for a plain action. */
  params?: Readonly<Record<string, unknown>>;
}

/** @experimental Expand `action` into the entries a surface renders. An
 *  action without an immediate invoker has none: `trigger` cannot start a
 *  drag, so a button for one would do nothing. */
export function actionItems(action: Action): ActionItem[] {
  if (action.invoker?.timing !== 'immediate') return [];
  if (!action.variants?.length) {
    return [{ key: action.id, action, label: action.label, icon: action.icon }];
  }
  return action.variants.map((v) => ({
    key: `${action.id}:${v.key}`,
    action,
    label: v.label,
    icon: v.icon ?? action.icon,
    params: v.params,
  }));
}
