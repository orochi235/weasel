/** One graph page as a Mermaid ER diagram: boxes as entities, their rows past the name as attributes, edges as relationships. */
import type { MarkerRef } from '@weasel-js/core';
import type { DataNode, LayoutDirection, Row } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { edgeStyleIn, graphOut, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { styleProps } from '../common/styles';
import { mermaidEscaped, mermaidIds } from '../common/text';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TB', up: 'BT', right: 'LR', left: 'RL' };

/** Each crow's-foot marker as the left and the right end of a relationship. */
const ENDS: Readonly<Record<string, readonly [string, string]>> = {
  'crow-zero-one': ['|o', 'o|'], 'crow-one': ['||', '||'], 'crow-zero-many': ['}o', 'o{'], 'crow-one-many': ['}|', '|{'], 'crow-many': ['}|', '|{'],
};

/** An entity's name and attribute lines. A row past the name with no field is written as it reads. */
function entityParts(node: DataNode): { name: string; attributes: string[] } {
  const rows: readonly Row[] = node.rows ?? (node.lines ?? []).map((text) => ({ kind: 'label', text }));
  const text = rows.filter((r) => r.kind === 'label' || r.kind === 'field');
  const [first, ...rest] = text;
  const name = first === undefined ? node.id : first.kind === 'label' ? first.text : `${first.label} ${first.value}`;
  return { name, attributes: rest.map((r) => (r.kind === 'field' ? `${r.label} ${r.value}` : (r as { text: string }).text)) };
}

function end(out: GraphOut, marker: MarkerRef | null | undefined, side: 0 | 1): string {
  const known = marker === null || marker === undefined ? undefined : ENDS[typeof marker === 'string' ? marker : marker.key];
  if (known === undefined) out.warnings.add('Mermaid ER relationships end in crow\'s feet; other ends were written as exactly one.');
  return (known ?? ENDS['crow-one']!)[side];
}

/** Writes the page `opts.page` names, else the first, as a Mermaid ER diagram. */
export function writeErDiagram(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'erDiagram\n', warnings: [] };
  const { page } = out;
  if (page.data.nodes.some((n) => n.at !== undefined)) out.warnings.add('Mermaid holds no positions; the page is laid out again when read.');
  if (out.clusters.length > 0) out.warnings.add('Mermaid ER diagrams have no containers; they were dropped.');
  const ids = mermaidIds(page.data.nodes.map((n) => n.id));
  const lines = [...titleLines(page.name), 'erDiagram'];
  if (page.direction !== undefined && page.direction !== 'down') lines.push(`  direction ${HEADER[page.direction]}`);
  for (const n of page.data.nodes) {
    const { name, attributes } = entityParts(n);
    const head = name === n.id ? ids.get(n.id)! : `${ids.get(n.id)!}["${mermaidEscaped([name])}"]`;
    if (attributes.length === 0) lines.push(`  ${head}`);
    else lines.push(`  ${head} {`, ...attributes.map((a) => `    ${a}`), '  }');
  }
  for (const e of out.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const style = edgeStyleIn(out, e);
    const body = style.dash !== undefined ? '..' : '--';
    lines.push(`  ${ids.get(e.from)} ${end(out, style.markerStart, 0)}${body}${end(out, style.markerEnd, 1)} ${ids.get(e.to)} : "${mermaidEscaped([e.label ?? ''])}"`);
  }
  for (const n of page.data.nodes) {
    const props = n.colors !== undefined ? styleProps(n.colors) : '';
    if (props !== '') lines.push(`  style ${ids.get(n.id)} ${props}`);
  }
  return { text: `${lines.join('\n')}\n`, warnings: out.warnings.all() };
}
