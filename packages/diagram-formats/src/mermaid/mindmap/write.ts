/** One graph page as a Mermaid mind map: the tree its edges make from the root, indented, each node in its outline's brackets. */
import type { DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { graphOut, nodeLines } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { mermaidEscaped } from '../common/text';
import { mindmapIds } from './read';

const BRACKETS: Readonly<Record<string, readonly [string, string]>> = {
  rect: ['[', ']'], roundRect: ['(', ')'], ellipse: ['((', '))'], cloud: ['))', '(('], hexagon: ['{{', '}}'],
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
  const roots = page.data.nodes.filter((n) => !hasParent.has(n.id));
  const order: { node: DataNode; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push({ node: out.byId.get(id)!, depth });
    for (const c of children.get(id) ?? []) visit(c, depth + 1);
  };
  if (roots[0] !== undefined) visit(roots[0].id, 0);
  if (seen.size < page.data.nodes.length) warnings.add('Mermaid mind maps hold one tree; shapes outside the first root\'s were dropped.');
  const generated = mindmapIds(order.map(() => ({})));
  const lines = [...titleLines(page.name), 'mindmap'];
  order.forEach(({ node, depth }, k) => {
    const text = mermaidEscaped(nodeLines(node, warnings, 'Mermaid'));
    const outline = typeof node.outline === 'string' ? node.outline : undefined;
    const brackets = outline === undefined ? undefined : BRACKETS[outline];
    if (node.outline !== undefined && brackets === undefined) warnings.add('Mermaid mind maps have five shapes; others were written plain.');
    const id = node.id === generated[k] ? '' : node.id;
    const plain = text.replace(/[()[\]{}]/g, (c) => `#${c.charCodeAt(0)};`);
    lines.push(`${'  '.repeat(depth + 1)}${brackets === undefined ? plain : `${id}${brackets[0]}${text}${brackets[1]}`}`);
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
