/** One graph page as a Mermaid mind map: the tree its edges make from the root, indented, each node in its outline's brackets. */
import type { DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { graphOut, nodeLines } from '../../graphWrite';
import { readsAsStatement, titleLines } from '../common/lines';
import { mermaidEscaped, mermaidIds } from '../common/text';
import { mindmapIds } from './read';
import { getOwn } from '@weasel-js/registry';

const BRACKETS: Readonly<Record<string, readonly [string, string]>> = {
  rect: ['[', ']'], roundRect: ['(', ')'], ellipse: ['((', '))'], cloud: [')', '('], hexagon: ['{{', '}}'],
};

/** Writes the page `opts.page` names, else the first, as a Mermaid mind map. */
export function writeMindmap(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'mindmap\n', warnings: [] };
  const { page, warnings } = out;
  if (out.clusters.length > 0) warnings.add('Mermaid mind maps have no containers; they were dropped.');
  if (out.edges.some((e) => e.label !== undefined || e.endLabels !== undefined)) warnings.add('Mermaid mind maps have no connector labels; they were dropped.');
  if (page.data.nodes.some((n) => n.colors !== undefined)) warnings.add('Mermaid mind maps hold no colors; they were dropped.');
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of out.edges) {
    if (!out.byId.has(e.from) || !out.byId.has(e.to) || hasParent.has(e.to)) continue;
    children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
    hasParent.add(e.to);
  }
  // Where a cycle leaves every node a parent, the first node roots the tree.
  const root = page.data.nodes.find((n) => !hasParent.has(n.id)) ?? page.data.nodes[0];
  const order: { node: DataNode; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number) => {
    seen.add(id);
    order.push({ node: out.byId.get(id)!, depth });
    for (const c of children.get(id) ?? []) if (!seen.has(c)) visit(c, depth + 1);
  };
  if (root !== undefined) visit(root.id, 0);
  if (seen.size < page.data.nodes.length) warnings.add('Mermaid mind maps hold one tree; shapes outside the first root\'s were dropped.');
  const kept = out.edges.filter((e) => seen.has(e.from) && seen.has(e.to)).length;
  if (kept > seen.size - 1) warnings.add('Mermaid mind maps hold a tree; connectors that would join a shape to a second parent, or close a loop, were dropped.');
  const generated = mindmapIds(order.map(() => ({})));
  const ids = mermaidIds(order.map(({ node }) => node.id));
  const lines = [...titleLines(page.name), 'mindmap'];
  order.forEach(({ node, depth }, k) => {
    // Trimmed as the reader trims them, before escaping, so a trim cannot make a markdown string of the text.
    const text = mermaidEscaped(nodeLines(node, warnings, 'Mermaid').map((l) => l.trim()), { also: /[()[\]{}]/g });
    const outline = typeof node.outline === 'string' ? node.outline : undefined;
    const brackets = outline === undefined ? undefined : getOwn(BRACKETS, outline);
    if (node.outline !== undefined && brackets === undefined) warnings.add('Mermaid mind maps have five shapes; others were written plain.');
    const own = /^[\w-]+$/.test(node.id) ? node.id : ids.get(node.id)!;
    const id = own === generated[k] ? '' : own;
    const plain = readsAsStatement(text) && !text.startsWith(':::') ? text : `"${text}"`;
    lines.push(`${'  '.repeat(depth + 1)}${brackets === undefined ? plain : `${id}${brackets[0]}${text}${brackets[1]}`}`);
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
