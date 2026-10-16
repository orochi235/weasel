import { matchQuery, type Findable } from '@weasel-js/registry';
import { filterTree, type TreeNode } from '../Tree';

/** A row of one of the editor's trees, with what its filter finds it by. */
export interface SoughtRow extends TreeNode {
  find: Findable;
}

/** `row` found by `find`, and typed ahead to by the same words. */
export function soughtRow<R extends TreeNode>(row: R, find: Findable): R & SoughtRow {
  return { ...row, textValue: find.text.filter(Boolean).join(' '), find };
}

/** The rows answering `query` through the matcher every action and pref search shares, under the branches that
 *  hold them. A row made without {@link soughtRow} is found by its `textValue`. */
export function seekRows(rows: readonly TreeNode[], query: string): readonly TreeNode[] {
  if (query.trim() === '') return rows;
  return filterTree(rows, (n) => matchQuery(query, (n as Partial<SoughtRow>).find ?? { text: [n.textValue] }) !== null);
}
