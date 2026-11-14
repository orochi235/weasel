/**
 * The entries an action contributes to a bar, menu or palette — one per
 * variant, or the action itself when it declares none.
 */
import type { IconSpec } from '@weasel-js/icons';
import type { MenuGrade } from '@weasel-js/menu';
import type { Action, ActionVariant } from './action';

const NO_TAGS: readonly string[] = Object.freeze([]);

/** One renderable entry: an action, optionally with params. */
export interface ActionItem {
  /** `action.id`, or `action.id:variant.key` — unique across a registry. */
  key: string;
  action: Action;
  label: string;
  icon?: IconSpec;
  /** The variant's, else the action's. */
  description?: string;
  /** The variant's, else the action's. */
  grade?: MenuGrade;
  /** Display text for the shortcut: the variant's, else the action's. Absent, a surface shows the bindings
   *  `actionShortcuts` finds for `params` (`actionItemShortcuts`). */
  shortcut?: string;
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
    return [{ key: action.id, action, label: action.label, icon: action.icon, tags: action.tags ?? NO_TAGS, ...shown(action) }];
  }
  return action.variants.map((v) => ({
    key: `${action.id}:${v.key}`,
    action,
    label: v.label,
    icon: v.icon ?? action.icon,
    tags: v.tags ? [...(action.tags ?? NO_TAGS), ...v.tags] : action.tags ?? NO_TAGS,
    params: v.params,
    ...shown(action, v),
  }));
}

/** The description, grade and shortcut text an entry shows, each only when set. */
function shown(action: Action, v?: ActionVariant): Pick<ActionItem, 'description' | 'grade' | 'shortcut'> {
  const description = v?.description ?? action.description;
  const grade = v?.grade ?? action.grade;
  const shortcut = v?.shortcut ?? action.shortcut;
  return {
    ...(description === undefined ? {} : { description }),
    ...(grade === undefined ? {} : { grade }),
    ...(shortcut === undefined ? {} : { shortcut }),
  };
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
