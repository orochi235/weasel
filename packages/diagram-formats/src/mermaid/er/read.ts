/**
 * A Mermaid ER diagram as a one-page document: each entity a box of its name
 * row, a divider, and a `field` row per attribute (its type as the label; its
 * name, keys, and comment as the value), and each relationship an edge with
 * a crow's-foot marker at each end, dashed when it does not identify.
 */
import type { MarkerRef } from '@weasel-js/core';
import type { DataEdge, DataNode, Row } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Warnings, decodeEntities, graphPage } from '../../graphRead';
import { DIRECTIONS } from '../class/read';
import { pageNameOf } from '../common/lines';
import { StyleSheet } from '../common/styles';
import { parseErDiagram, type ErAttribute, type ErCardinality } from './parse';

/** Each cardinality's crow's-foot marker. */
export const CROWS: Readonly<Record<ErCardinality, MarkerRef>> = {
  'zero-one': 'crow-zero-one', one: 'crow-one', 'zero-many': 'crow-zero-many', 'one-many': 'crow-one-many',
};

/** An attribute's field value: its name, then its keys, then its comment in quotes. */
export const attributeValue = (a: ErAttribute): string =>
  [a.name, ...(a.keys.length > 0 ? [a.keys.join(', ')] : []), ...(a.comment !== undefined ? [`"${a.comment}"`] : [])].join(' ');

/** Reads a Mermaid ER diagram into a one-page document of `notation` `'er'`. Throws, naming the line, on text that is not one. */
export function readErDiagram(text: string): ImportResult {
  const { source, stmts } = parseErDiagram(text);
  const warnings = new Warnings();
  const styles = new StyleSheet(warnings);
  const entities = new Map<string, { label?: string; attributes: ErAttribute[] }>();
  const entity = (id: string) => {
    if (!entities.has(id)) entities.set(id, { attributes: [] });
    return entities.get(id)!;
  };
  const edges: DataEdge[] = [];
  let direction: string | undefined;
  for (const s of stmts) {
    if (s.kind === 'entity') {
      const e = entity(s.id);
      if (s.label !== undefined) e.label = decodeEntities(s.label, true);
      e.attributes.push(...s.attributes);
      if (s.cssClass !== undefined) styles.assign(s.id, s.cssClass);
    } else if (s.kind === 'relation') {
      entity(s.from);
      entity(s.to);
      edges.push({
        from: s.from, to: s.to, ...(s.label !== '' ? { label: decodeEntities(s.label, true) } : {}),
        colors: { markerStart: CROWS[s.fromCard], markerEnd: CROWS[s.toCard], ...(s.dashed ? { dash: [4, 4] } : {}) },
      });
    } else if (s.kind === 'direction') direction = s.value;
    else styles.statement(s.text);
  }
  const nodes: DataNode[] = [...entities].map(([id, e]) => {
    const rows: Row[] = [
      { kind: 'label', text: e.label ?? id },
      ...(e.attributes.length > 0 ? [{ kind: 'divider' } as const] : []),
      ...e.attributes.map((a): Row => ({ kind: 'field', label: a.type, value: attributeValue(a) })),
    ];
    const colors = styles.colorsOf(id);
    return { id, rows, ...(colors !== undefined ? { colors } : {}) };
  });
  const name = pageNameOf(source, warnings);
  const dir = direction !== undefined ? DIRECTIONS[direction] : undefined;
  const page = graphPage({ ...(name !== undefined ? { name } : {}), ...(dir !== undefined ? { direction: dir } : {}), nodes, edges, containers: [] });
  return { document: { pages: [{ ...page, notation: 'er' }] }, warnings: warnings.all() };
}
