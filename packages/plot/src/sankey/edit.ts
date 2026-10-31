/** Edits to a sankey, as plain data in and out. */
import { sankeyNodes } from './layout';
import type { SankeyData } from './types';

/** `data` with link `link`'s value set to `value`. Throws on a link it does not hold. */
export function setSankeyValue(data: SankeyData, link: number, value: number): SankeyData {
  const target = data.links[link];
  if (target === undefined) throw new Error(`setSankeyValue: no link ${link}`);
  if (target.value === value) return data;
  return { ...data, links: data.links.map((l, i) => (i === link ? { ...l, value } : l)) };
}

/** `data` with node `from` called `to` in every link. Throws on a node it does not hold, or a name another node has. */
export function renameSankeyNode(data: SankeyData, from: string, to: string): SankeyData {
  const nodes = sankeyNodes(data);
  if (!nodes.includes(from)) throw new Error(`renameSankeyNode: no node "${from}"`);
  if (from === to) return data;
  if (nodes.includes(to)) throw new Error(`renameSankeyNode: a node is already called "${to}"`);
  const named = (n: string) => (n === from ? to : n);
  return { ...data, links: data.links.map((l) => (l.source === from || l.target === from ? { ...l, source: named(l.source), target: named(l.target) } : l)) };
}
