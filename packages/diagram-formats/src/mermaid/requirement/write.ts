/** One graph page as a Mermaid requirement diagram: boxes as requirements and elements, each named by its name row,
 *  and edges as relationships. */
import type { DataNode, LayoutDirection, Row } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { graphOut } from '../../graphWrite';
import type { Warnings } from '../../graphRead';
import { titleLines } from '../common/lines';
import { styleProps } from '../common/styles';
import { fieldName, oneLine } from '../common/text';
import { BLOCK_KINDS, RELATIONS } from './parse';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TB', up: 'BT', right: 'LR', left: 'RL' };

/** A name as Mermaid reads it: bare when it is one word, else quoted. {@link blockName} has taken out its `"`. */
const nameOf = (name: string): string => (/^[\w-]+$/.test(name) ? name : `"${name}"`);

/** A field's value as the reader takes it back: quoted where it opens and closes with a quote, or with a space,
 *  which the reader would strip. */
const fieldValue = (v: string): string => (/^".*"$/s.test(v) || v !== v.trim() ? `"${v}"` : v);

/** A box's block kind, from a `<<kind>>` row, and its fields; a text row past the divider reads as `key: value`, and one
 *  before it other than the kind and the name is dropped. */
function writeBlock(node: DataNode, warnings: Warnings): { type: string; fields: [string, string][] } {
  const rows: readonly Row[] = node.rows ?? (node.lines ?? []).map((text) => ({ kind: 'label', text }));
  const kind = rows.find((r) => r.kind === 'label' && /^<<\w+>>$/.test(r.text)) as { text: string } | undefined;
  const type = kind?.text.slice(2, -2);
  const known = BLOCK_KINDS.find((k) => k === type);
  if (type !== undefined && known === undefined) warnings.add('Mermaid has six requirement kinds and elements; others were written as requirements.');
  const fields: [string, string][] = [];
  const name = nameRow(rows);
  let past = false;
  for (const r of rows) {
    if (r.kind === 'divider') past = true;
    else if (r.kind === 'label' && !past && r !== kind && r !== name) warnings.add('Mermaid requirements hold a name and named fields; text rows before the divider past the name were dropped.');
    else if (r.kind !== 'label' && r.kind !== 'field') warnings.add('Mermaid requirements hold text and fields only; other rows were dropped.');
    else if (r.kind === 'field') fields.push([fieldName(r.label, /\W+/g, 'requirement', (m) => warnings.add(m)), oneLine(r.value, 'requirement', (m) => warnings.add(m))]);
    else if (r.kind === 'label' && past) {
      const kv = /^(\w+)\s*:\s*(.*)$/s.exec(oneLine(r.text, 'requirement', (m) => warnings.add(m)));
      if (kv !== null) fields.push([kv[1]!, kv[2]!]);
      else warnings.add('Mermaid requirement fields are named; rows that name none were dropped.');
    }
  }
  return { type: known ?? 'requirement', fields };
}

/** The row naming a box: its first text row past the `<<kind>>` one. */
function nameRow(rows: readonly Row[]): Row | undefined {
  const labels = rows.filter((r) => r.kind === 'label');
  return labels[0] !== undefined && /^<<\w+>>$/.test(labels[0].text) ? labels[1] : labels[0];
}

/** A box's name: its name row, else its id, on one line with its `"` written as `'`, which a quoted name cannot hold. */
function blockName(node: DataNode, warnings: Warnings): string {
  const rows: readonly Row[] = node.rows ?? (node.lines ?? []).map((text) => ({ kind: 'label', text }));
  const named = nameRow(rows);
  const one = named?.kind === 'label' ? oneLine(named.text, 'requirement', (m) => warnings.add(m)).trim() : '';
  const name = one !== '' ? one : oneLine(node.id, 'requirement', (m) => warnings.add(m));
  if (name.includes('"')) warnings.add('Mermaid requirement names hold no double quotes; they were written as single ones.');
  return name.replace(/"/g, "'");
}

/** Each box's name, a name two boxes share made distinct by a number. */
function blockNames(nodes: readonly DataNode[], warnings: Warnings): Map<string, string> {
  const taken = new Set<string>();
  return new Map(nodes.map((n) => {
    const base = blockName(n, warnings);
    let name = base;
    for (let k = 2; taken.has(name); k++) name = `${base} ${k}`;
    taken.add(name);
    return [n.id, name];
  }));
}

/** Writes the page `opts.page` names, else the first, as a Mermaid requirement diagram. */
export function writeRequirementDiagram(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'requirementDiagram\n', warnings: [] };
  const { page, warnings } = out;
  if (out.clusters.length > 0) warnings.add('Mermaid requirement diagrams have no containers; they were dropped.');
  const lines = [...titleLines(page.name), 'requirementDiagram'];
  if (page.direction !== undefined && page.direction !== 'down') lines.push(`  direction ${HEADER[page.direction]}`);
  const names = blockNames(page.data.nodes, warnings);
  const name = (id: string) => nameOf(names.get(id) ?? id);
  for (const n of page.data.nodes) {
    const { type, fields } = writeBlock(n, warnings);
    lines.push(`  ${type} ${name(n.id)} {`, ...fields.map(([k, v]) => `    ${k}: ${fieldValue(v)}`), '  }');
  }
  for (const e of out.edges) {
    if (!out.byId.has(e.from) || !out.byId.has(e.to)) continue;
    const type = /^<<(\w+)>>$/.exec(e.label ?? '')?.[1];
    const known = RELATIONS.find((r) => r === type);
    if (known === undefined) warnings.add('Mermaid relationships are one of seven kinds, named in their label; others were written as traces.');
    lines.push(`  ${name(e.from)} - ${known ?? 'traces'} -> ${name(e.to)}`);
  }
  for (const n of page.data.nodes) {
    const props = n.colors !== undefined ? styleProps(n.colors) : '';
    if (props === '') continue;
    if (/^[\w-]+$/.test(names.get(n.id)!)) lines.push(`  style ${names.get(n.id)} ${props}`);
    else warnings.add('Mermaid styles name a block by one word; colors on blocks with longer names were dropped.');
  }
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
