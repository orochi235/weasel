/**
 * A Mermaid mind map as a one-page document: each node a shape joined to its
 * parent by an unmarked edge, laid out on import by `radial`, the root in the
 * middle and its branches to both sides.
 */
import type { DataEdge, DataNode, Outline } from '@weasel-js/diagram';
import type { ImportResult, PageLayout } from '../../document';
import { Warnings, graphPage } from '../../graphRead';
import { pageNameOf } from '../common/lines';
import { textLines } from '../common/text';
import { parseMindmap, type MindmapNode, type MindmapShape } from './parse';

/** Each bracketed shape's outline. A plain node has none of its own. */
export const SHAPE_OUTLINES: Readonly<Record<Exclude<MindmapShape, 'plain'>, Outline>> = {
  square: 'rect', rounded: 'roundRect', circle: 'ellipse', bang: 'cloud', cloud: 'cloud', hexagon: 'hexagon',
};

/** How a mind map lays out: the root in the middle, its branches balanced to its right and left. */
export const MINDMAP_LAYOUT: PageLayout = { name: 'radial' };

/** The ids a mind map's nodes take, in order: its own where it gives one, else `n` and its place, made unique. */
export function mindmapIds(nodes: readonly { id?: string }[]): string[] {
  const taken = new Set(nodes.flatMap((n) => (n.id !== undefined ? [n.id] : [])));
  return nodes.map((n, k) => {
    if (n.id !== undefined) return n.id;
    let id = `n${k + 1}`;
    for (let m = 2; taken.has(id); m++) id = `n${k + 1}_${m}`;
    taken.add(id);
    return id;
  });
}

/** Reads a Mermaid mind map into a one-page document of `notation` `'mindmap'`. Throws, naming the line, on text that is not one. */
export function readMindmap(text: string): ImportResult {
  const { source, root } = parseMindmap(text);
  const warnings = new Warnings();
  const order: MindmapNode[] = [];
  const parents = new Map<MindmapNode, MindmapNode>();
  const visit = (n: MindmapNode) => {
    order.push(n);
    for (const c of n.children) {
      parents.set(c, n);
      visit(c);
    }
  };
  if (root !== null) visit(root);
  const ids = mindmapIds(order);
  const idOf = new Map(order.map((n, k) => [n, ids[k]!]));
  const nodes: DataNode[] = order.map((n) => {
    if (n.icon !== undefined) warnings.add('Mermaid mind map icons were dropped.');
    if (n.classes !== undefined) warnings.add('Mermaid mind map classes were dropped.');
    return { id: idOf.get(n)!, lines: textLines(n.text), ...(n.shape !== 'plain' ? { outline: SHAPE_OUTLINES[n.shape] } : {}) };
  });
  const edges: DataEdge[] = order.filter((n) => parents.has(n)).map((n) => ({
    from: idOf.get(parents.get(n)!)!, to: idOf.get(n)!, colors: { markerEnd: null },
  }));
  const name = pageNameOf(source, warnings);
  const page = graphPage({ ...(name !== undefined ? { name } : {}), nodes, edges, containers: [] });
  return { document: { pages: [{ ...page, layout: MINDMAP_LAYOUT, notation: 'mindmap' }] }, warnings: warnings.all() };
}
