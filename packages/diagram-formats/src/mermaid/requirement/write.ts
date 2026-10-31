/** One graph page as a Mermaid requirement diagram: boxes as requirements and elements, edges as relationships. */
import type { DataNode, LayoutDirection, Row } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { graphOut } from '../../graphWrite';
import type { Warnings } from '../../graphRead';
import { titleLines } from '../common/lines';
import { styleProps } from '../common/styles';
import { BLOCK_KINDS, RELATIONS } from './parse';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TB', up: 'BT', right: 'LR', left: 'RL' };

/** A name as Mermaid reads it: bare when it is one word, else quoted. */
const nameOf = (name: string): string => (/^[\w-]+$/.test(name) ? name : `"${name.replace(/"/g, "'")}"`);

/** A box's block kind, from a `<<kind>>` row, and its fields; a text row past the divider reads as `key: value`. */
function blockOf(node: DataNode, warnings: Warnings): { type: string; fields: [string, string][] } {
  const rows: readonly Row[] = node.rows ?? (node.lines ?? []).map((text) => ({ kind: 'label', text }));
  const kind = rows.find((r) => r.kind === 'label' && /^<<\w+>>$/.test(r.text)) as { text: string } | undefined;
  const type = kind?.text.slice(2, -2);
  const known = BLOCK_KINDS.find((k) => k === type);
  if (type !== undefined && known === undefined) warnings.add('Mermaid has six requirement kinds and elements; others were written as requirements.');
  const fields: [string, string][] = [];
  let past = false;
  for (const r of rows) {
    if (r.kind === 'divider') past = true;
    else if (r.kind === 'field') fields.push([r.label, r.value]);
    else if (r.kind === 'label' && past) {
      const kv = /^(\w+)\s*:\s*(.*)$/.exec(r.text);
      if (kv !== null) fields.push([kv[1]!, kv[2]!]);
      else warnings.add('Mermaid requirement fields are named; rows that name none were dropped.');
    }
  }
  return { type: known ?? 'requirement', fields };
}

/** Writes the page `opts.page` names, else the first, as a Mermaid requirement diagram. */
export function writeRequirementDiagram(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'requirementDiagram\n', warnings: [] };
  const { page, warnings } = out;
  if (out.clusters.length > 0) warnings.add('Mermaid requirement diagrams have no containers; they were dropped.');
  const lines = [...titleLines(page.name), 'requirementDiagram'];
  if (page.direction !== undefined && page.direction !== 'down') lines.push(`  direction ${HEADER[page.direction]}`);
  for (const n of page.data.nodes) {
    const { type, fields } = blockOf(n, warnings);
    lines.push(`  ${type} ${nameOf(n.id)} {`, ...fields.map(([k, v]) => `    ${k}: ${v}`), '  }');
  }
  for (const e of out.edges) {
    if (!out.byId.has(e.from) || !out.byId.has(e.to)) continue;
    const type = /^<<(\w+)>>$/.exec(e.label ?? '')?.[1];
    const known = RELATIONS.find((r) => r === type);
    if (known === undefined) warnings.add('Mermaid relationships are one of seven kinds, named in their label; others were written as traces.');
    lines.push(`  ${nameOf(e.from)} - ${known ?? 'traces'} -> ${nameOf(e.to)}`);
  }
  for (const n of page.data.nodes) {
    const props = n.colors !== undefined ? styleProps(n.colors) : '';
    if (props !== '' && /^[\w-]+$/.test(n.id)) lines.push(`  style ${n.id} ${props}`);
  }
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
