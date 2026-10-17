/**
 * Finding actions by tag: gathering the ones that carry it, and a person's
 * search matching it as it matches a label.
 */
import { hasTag, matchQuery, type QueryMatch } from '@weasel-js/registry';
import type { Action } from './action';
import { actionItems, actionItemTitle, type ActionItem } from './actionItems';

/** The actions carrying `tag`, themselves or on any variant, in
 *  the order given. Drags included, which have no entries to show. */
export function actionsTagged(actions: readonly Action[], tag: string): Action[] {
  return actions.filter((a) => hasTag(a.tags, tag) || (a.variants?.some((v) => hasTag(v.tags, tag)) ?? false));
}

/** The entries carrying `tag`: what a bar or a menu built from
 *  a tag shows. A variant that does not carry it is left out. */
export function taggedActionItems(actions: readonly Action[], tag: string): ActionItem[] {
  return actionsTagged(actions, tag).flatMap(actionItems).filter((i) => hasTag(i.tags, tag));
}

/** Whether `item` answers a search for `query`, by its palette title or
 *  by a tag, and which. */
export function matchActionItem(item: ActionItem, query: string): QueryMatch | null {
  return matchQuery(query, { text: [actionItemTitle(item)], tags: item.tags });
}
