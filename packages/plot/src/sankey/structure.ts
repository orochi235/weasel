/** Edits to a sankey's links as a collection, each link's ends, and its nodes, as plain data in and out. A node is
 *  named by its label and exists while a link names it. */
import { freshName, insertAt, moveAt, removeAt, updateAt } from '../editing/lists';
import { sankeyNodes } from './layout';
import type { SankeyData, SankeyLink } from './types';

/** `data` with `link` inserted before link `at`; absent, a flow of 1 from the last link's target to a fresh node. */
export function insertSankeyLink(data: SankeyData, at: number, link?: SankeyLink): SankeyData {
  const nodes = sankeyNodes(data);
  const source = data.links[data.links.length - 1]?.target ?? freshName('Node', nodes, nodes.length + 1);
  const next = link ?? { source, target: freshName('Node', [...nodes, source], nodes.length + 1), value: 1 };
  return { ...data, links: insertAt(data.links, at, next, 'insertSankeyLink') };
}

/** `data` without link `link`. Throws on a link it does not hold. */
export const removeSankeyLink = (data: SankeyData, link: number): SankeyData =>
  ({ ...data, links: removeAt(data.links, link, 'removeSankeyLink') });

/** `data` with link `from` moved to index `to`, counted once it is taken out. */
export const moveSankeyLink = (data: SankeyData, from: number, to: number): SankeyData =>
  (from === to ? data : { ...data, links: moveAt(data.links, from, to, 'moveSankeyLink') });

/** `data` with link `link` running from (`'source'`) or to (`'target'`) node `name`, trimmed; a node it names that no
 *  link did is added. Throws on an empty name. */
export function setSankeyEnd(data: SankeyData, link: number, end: 'source' | 'target', name: string): SankeyData {
  const next = name.trim();
  if (next === '') throw new Error('setSankeyEnd: a node needs a name');
  const links = updateAt(data.links, link, (l) => (l[end] === next ? l : { ...l, [end]: next }), 'setSankeyEnd');
  return links[link] === data.links[link] ? data : { ...data, links };
}

/** `data` without node `name`: every link to or from it is taken out. Throws on a node it does not hold. */
export function removeSankeyNode(data: SankeyData, name: string): SankeyData {
  if (!sankeyNodes(data).includes(name)) throw new Error(`removeSankeyNode: no node "${name}"`);
  return { ...data, links: data.links.filter((l) => l.source !== name && l.target !== name) };
}
