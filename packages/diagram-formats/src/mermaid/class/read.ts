/**
 * A Mermaid class diagram as a one-page document: each class a box of a name
 * row, a divider, attribute rows, a divider, and method rows; namespaces as
 * containers; notes as `note` shapes; relations as edges with UML ends.
 */
import type { MarkerRef } from '@weasel-js/core';
import type { DataContainer, DataEdge, DataNode, EdgeStyle, LayoutDirection, Row } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Membership, Warnings, decodeEntities, graphPage } from '../../graphRead';
import { pageNameOf } from '../common/lines';
import { StyleSheet } from '../common/styles';
import { parseClassDiagram, type ClassHead, type ClassMember, type ClassStmt } from './parse';

export const DIRECTIONS: Readonly<Record<string, LayoutDirection>> = { TB: 'down', TD: 'down', BT: 'up', LR: 'right', RL: 'left' };

/** Each end a relation draws, by its head and whether its line is dashed. */
export function headMarker(head: ClassHead | undefined, dashed: boolean): MarkerRef | null {
  if (head === undefined) return null;
  if (head === 'triangle') return 'triangle-hollow';
  if (head === 'diamond') return 'diamond';
  if (head === 'hollow-diamond') return 'diamond-hollow';
  return dashed ? 'arrow-open' : 'arrow';
}

interface ClassDraft { label?: string; generic?: string; annotations: string[]; members: ClassMember[] }

class ClassReader {
  readonly warnings = new Warnings();
  readonly styles = new StyleSheet(this.warnings);
  readonly membership = new Membership(this.warnings, 'Mermaid');
  readonly classes = new Map<string, ClassDraft>();
  readonly notes: DataNode[] = [];
  readonly edges: DataEdge[] = [];
  readonly noteEdges: DataEdge[] = [];
  readonly namespaces: string[] = [];
  direction: string | undefined;

  draft(id: string, ns: string | null = null): ClassDraft {
    let d = this.classes.get(id);
    if (d === undefined) {
      d = { annotations: [], members: [] };
      this.classes.set(id, d);
    }
    this.membership.place(id, ns);
    return d;
  }

  walk(stmts: readonly ClassStmt[], ns: string | null): void {
    for (const s of stmts) {
      if (s.kind === 'class') {
        const d = this.draft(s.id, ns);
        if (s.label !== undefined) d.label = decodeEntities(s.label, true);
        if (s.generic !== undefined) d.generic = s.generic;
        d.annotations.push(...s.annotations);
        d.members.push(...s.members);
        if (s.cssClass !== undefined) this.styles.assign(s.id, s.cssClass);
      } else if (s.kind === 'member') this.draft(s.id).members.push(s.member);
      else if (s.kind === 'annotation') this.draft(s.id).annotations.push(s.name);
      else if (s.kind === 'relation') this.relation(s);
      else if (s.kind === 'namespace') {
        this.membership.openCluster(s.id, ns);
        if (!this.namespaces.includes(s.id)) this.namespaces.push(s.id);
        this.walk(s.stmts, s.id);
      } else if (s.kind === 'note') this.note(s.text, s.for);
      else if (s.kind === 'cssClass') for (const id of s.ids) this.styles.assign(id, s.name);
      else if (s.kind === 'direction') this.direction = s.value;
      else if (s.kind === 'style') this.styles.statement(s.text, false);
      else this.warnings.list('Mermaid statements a diagram does not hold were dropped', s.keyword);
    }
  }

  relation(s: Extract<ClassStmt, { kind: 'relation' }>): void {
    this.draft(s.from);
    this.draft(s.to);
    const start = headMarker(s.start, s.dashed);
    const end = headMarker(s.end, s.dashed);
    const colors: Partial<EdgeStyle> = {
      ...(s.dashed ? { dash: [4, 4] } : {}),
      ...(start !== null ? { markerStart: start } : {}),
      ...(end !== 'arrow' ? { markerEnd: end } : {}),
    };
    const card = (c: string) => decodeEntities(c, true);
    const endLabels = { ...(s.fromCard !== undefined ? { from: card(s.fromCard) } : {}), ...(s.toCard !== undefined ? { to: card(s.toCard) } : {}) };
    this.edges.push({
      from: s.from, to: s.to,
      ...(s.label !== undefined ? { label: s.label } : {}),
      ...(Object.keys(endLabels).length > 0 ? { endLabels } : {}),
      ...(Object.keys(colors).length > 0 ? { colors } : {}),
    });
  }

  note(text: string, target: string | undefined): void {
    const id = `note-${this.notes.length + 1}`;
    this.notes.push({ id, outline: 'note', lines: decodeEntities(text, true).split('\\n') });
    if (target === undefined) return;
    this.draft(target);
    this.noteEdges.push({ from: id, to: target, colors: { dash: [4, 4], markerEnd: null } });
  }
}

/** A class's rows: its annotations and name, a divider, its attributes, a divider, its methods. */
export function classRows(id: string, d: ClassDraft): Row[] {
  const label = (text: string): Row => ({ kind: 'label', text });
  const name = `${d.label ?? id}${d.generic !== undefined ? `<${d.generic}>` : ''}`;
  return [
    ...d.annotations.map((a) => label(`<<${a}>>`)), label(name), { kind: 'divider' },
    ...d.members.filter((m) => !m.method).map((m) => label(m.text)), { kind: 'divider' },
    ...d.members.filter((m) => m.method).map((m) => label(m.text)),
  ];
}

/** Reads a Mermaid class diagram into a one-page document of `notation` `'class'`. Throws, naming the line, on text that is not one. */
export function readClassDiagram(text: string): ImportResult {
  const { source, stmts } = parseClassDiagram(text);
  const r = new ClassReader();
  r.walk(stmts, null);
  const nodes: DataNode[] = [...r.classes].map(([id, d]) => {
    const colors = r.styles.colorsOf(id);
    return { id, rows: classRows(id, d), ...(colors !== undefined ? { colors } : {}) };
  });
  const containers: DataContainer[] = r.namespaces.map((id) => {
    const members = r.membership.members(id);
    return { id, role: 'container', label: id, ...(members.length > 0 ? { members } : {}) };
  });
  const name = pageNameOf(source, r.warnings);
  const direction = r.direction !== undefined ? DIRECTIONS[r.direction] : undefined;
  const page = graphPage({
    ...(name !== undefined ? { name } : {}),
    ...(direction !== undefined ? { direction } : {}),
    nodes: [...nodes, ...r.notes], edges: [...r.edges, ...r.noteEdges], containers,
  });
  return { document: { pages: [{ ...page, notation: 'class' }] }, warnings: r.warnings.all() };
}
