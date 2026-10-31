/**
 * A Mermaid requirement diagram as a one-page document: each requirement or
 * element a box of its `<<kind>>` and name rows, a divider, and a `field` row
 * per field, and each relationship a dashed arrow labeled `<<kind>>`.
 */
import type { DataEdge, DataNode, Row } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Warnings, graphPage } from '../../graphRead';
import { DIRECTIONS } from '../class/read';
import { pageNameOf } from '../common/lines';
import { StyleSheet } from '../common/styles';
import { parseRequirementDiagram } from './parse';

/** Reads a Mermaid requirement diagram into a one-page document of `notation` `'requirement'`. Throws, naming the line, on text that is not one. */
export function readRequirementDiagram(text: string): ImportResult {
  const { source, stmts } = parseRequirementDiagram(text);
  const warnings = new Warnings();
  const styles = new StyleSheet(warnings);
  const blocks = new Map<string, { type: string; fields: [string, string][] } | null>();
  const edges: DataEdge[] = [];
  let direction: string | undefined;
  for (const s of stmts) {
    if (s.kind === 'block') blocks.set(s.name, { type: s.type, fields: s.fields });
    else if (s.kind === 'relation') {
      for (const end of [s.from, s.to]) if (!blocks.has(end)) blocks.set(end, null);
      edges.push({ from: s.from, to: s.to, label: `<<${s.type}>>`, colors: { dash: [4, 4] } });
    } else if (s.kind === 'direction') direction = s.value;
    else styles.statement(s.text);
  }
  const nodes: DataNode[] = [...blocks].map(([id, b]) => {
    const rows: Row[] = b === null ? [{ kind: 'label', text: id }] : [
      { kind: 'label', text: `<<${b.type}>>` }, { kind: 'label', text: id },
      ...(b.fields.length > 0 ? [{ kind: 'divider' } as const] : []),
      ...b.fields.map(([label, value]): Row => ({ kind: 'field', label, value })),
    ];
    const colors = styles.colorsOf(id);
    return { id, rows, ...(colors !== undefined ? { colors } : {}) };
  });
  if ([...blocks.values()].includes(null)) warnings.add('Mermaid relationships named blocks the diagram never declares; they were read as plain boxes.');
  const name = pageNameOf(source, warnings);
  const dir = direction !== undefined ? DIRECTIONS[direction] : undefined;
  const page = graphPage({ ...(name !== undefined ? { name } : {}), ...(dir !== undefined ? { direction: dir } : {}), nodes, edges, containers: [] });
  return { document: { pages: [{ ...page, notation: 'requirement' }] }, warnings: warnings.all() };
}
