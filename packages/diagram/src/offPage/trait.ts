/**
 * Off-page markers as data: what a connector cut at the page gap holds, and
 * what each of its two tags holds. The pass that writes both is `install`.
 */

/** A connector whose ends sit on different pages: its reference letter, and
 *  the pages its `from` and `to` ends are on. */
export interface OffPageSplit {
  ref: string;
  from: string;
  to: string;
}

/** Which end of which connector a tag names the far page for. */
export interface OffPageTag {
  edge: string;
  end: 'from' | 'to';
}

/** The id of the tag at end `end` of connector `edgeId`. */
export const offPageTagId = (edgeId: string, end: 'from' | 'to'): string => `${edgeId}/offpage-${end}`;

/** The off-page tag trait on a node's data (`data.diagram.offPageTag`), or `null`. */
export function offPageTagOf(node: { data: unknown }): OffPageTag | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as { diagram?: { offPageTag?: unknown } }).diagram;
  const tag = trait !== null && typeof trait === 'object' ? trait.offPageTag : undefined;
  if (tag === null || typeof tag !== 'object') return null;
  const { edge, end } = tag as Partial<OffPageTag>;
  return typeof edge === 'string' && (end === 'from' || end === 'to') ? { edge, end } : null;
}
