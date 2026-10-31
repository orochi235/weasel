/**
 * A Mermaid flowchart as a one-page document: subgraphs as containers, and
 * `classDef`, `class`, `style`, and `linkStyle` as the items' own colors.
 * Mermaid holds no geometry, so the page is laid out on import.
 */
import type { MarkerRef } from '@weasel-js/core';
import type { DataContainer, DataEdge, DataNode, EdgeStyle, LayoutDirection, Outline } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Membership, Warnings, graphPage } from '../../graphRead';
import { checkProps, dashOf, nodeColors, px } from '../common/styles';
import { textLines } from '../common/text';
import type { LinkHead, MermaidShape } from './lex';
import { parseFlowchart, type MermaidLink, type MermaidNodeRef, type MermaidStmt, type StyleProps } from './parse';

const DIRECTIONS: Readonly<Record<string, LayoutDirection>> = {
  TB: 'down', TD: 'down', BT: 'up', LR: 'right', RL: 'left', 'v': 'down', '^': 'up', '>': 'right', '<': 'left',
};

const SHAPE_OUTLINES: Readonly<Partial<Record<MermaidShape, Outline>>> = {
  rect: 'rect', rounded: 'roundRect', stadium: 'stadium', circle: 'ellipse', 'double-circle': 'doubleEllipse', diamond: 'diamond',
  cylinder: 'cylinder',
  hexagon: 'hexagon', 'lean-right': 'parallelogram', 'lean-left': 'parallelogram', trapezoid: 'trapezoid', 'inv-trapezoid': 'trapezoid',
};

const META_OUTLINES: Readonly<Record<string, Outline>> = {
  rect: 'rect', rectangle: 'rect', proc: 'rect', process: 'rect', rounded: 'roundRect', event: 'roundRect', stadium: 'stadium',
  pill: 'stadium', terminal: 'stadium', circle: 'ellipse', circ: 'ellipse', 'dbl-circ': 'doubleEllipse', 'double-circle': 'doubleEllipse',
  cyl: 'cylinder', cylinder: 'cylinder', db: 'cylinder', database: 'cylinder', doc: 'document', document: 'document',
  cloud: 'cloud', tri: 'triangle', triangle: 'triangle', extract: 'triangle',
  diam: 'diamond', diamond: 'diamond', decision: 'diamond', question: 'diamond', hex: 'hexagon', hexagon: 'hexagon',
  prepare: 'hexagon', 'lean-r': 'parallelogram', 'lean-right': 'parallelogram', 'in-out': 'parallelogram',
  'lean-l': 'parallelogram', 'lean-left': 'parallelogram', 'out-in': 'parallelogram', 'trap-b': 'trapezoid',
  trapezoid: 'trapezoid', priority: 'trapezoid', 'trap-t': 'trapezoid', 'inv-trapezoid': 'trapezoid', manual: 'trapezoid',
};

interface NodeDraft { lines: string[]; outline: Outline; classes: string[] }
interface EdgeDraft { edge: DataEdge; index: number }


class MermaidReader {
  readonly warnings = new Warnings();
  readonly membership = new Membership(this.warnings, 'Mermaid');
  readonly nodes = new Map<string, NodeDraft>();
  readonly edges: EdgeDraft[] = [];
  readonly subgraphs = new Map<string, string | undefined>();
  readonly classDefs = new Map<string, StyleProps>();
  readonly styles = new Map<string, StyleProps>();
  readonly classes = new Map<string, string[]>();
  readonly linkStyles = new Map<number | 'default', StyleProps>();
  links = 0;

  constructor(readonly subgraphIds: ReadonlySet<string>) {}

  mention(ref: MermaidNodeRef, cluster: string | null): void {
    if (this.subgraphIds.has(ref.id) && ref.shape === undefined && ref.meta === undefined) {
      for (const c of ref.classes) this.addClass(ref.id, c);
      return;
    }
    let draft = this.nodes.get(ref.id);
    if (draft === undefined) {
      draft = { lines: [ref.id], outline: 'rect', classes: [] };
      this.nodes.set(ref.id, draft);
    }
    this.membership.place(ref.id, cluster);
    if (ref.shape !== undefined) {
      draft.lines = textLines(ref.text ?? '');
      draft.outline = this.outline(SHAPE_OUTLINES[ref.shape], ref.shape);
    }
    if (ref.meta?.shape !== undefined) draft.outline = this.outline(META_OUTLINES[ref.meta.shape], ref.meta.shape);
    if (ref.meta?.label !== undefined) draft.lines = textLines(ref.meta.label);
    for (const c of ref.classes) this.addClass(ref.id, c);
  }

  outline(outline: Outline | undefined, name: string): Outline {
    if (outline !== undefined) return outline;
    this.warnings.list('Mermaid shapes read as rectangles', name);
    return 'rect';
  }

  addClass(id: string, name: string): void {
    this.classes.set(id, [...(this.classes.get(id) ?? []), name]);
  }

  marker(head: LinkHead | undefined): MarkerRef | null {
    if (head === undefined) return null;
    if (head === 'o') return 'circle';
    if (head === 'x') this.warnings.add('Mermaid cross ends read as arrows.');
    return 'arrow';
  }

  link(link: MermaidLink, from: string, to: string): void {
    const index = this.links++;
    if (link.stroke === 'invisible') {
      this.warnings.add('Mermaid invisible links were dropped.');
      return;
    }
    const start = this.marker(link.start);
    const end = this.marker(link.end);
    const colors: Partial<EdgeStyle> = {
      ...(link.stroke === 'dotted' ? { dash: [4, 4] } : {}),
      ...(link.stroke === 'thick' ? { width: 3 } : {}),
      ...(start !== null ? { markerStart: start } : {}),
      ...(end !== 'arrow' ? { markerEnd: end } : {}),
    };
    const label = link.text === undefined ? [] : textLines(link.text).filter((l) => l !== '');
    this.edges.push({
      edge: { from, to, ...(label.length > 0 ? { label: label.join(' ') } : {}), ...(Object.keys(colors).length > 0 ? { colors } : {}) },
      index,
    });
  }

  walk(stmts: readonly MermaidStmt[], cluster: string | null): void {
    for (const s of stmts) {
      if (s.kind === 'chain') {
        for (const g of s.groups) for (const ref of g) this.mention(ref, cluster);
        s.links.forEach((link, k) => {
          for (const from of s.groups[k]!) for (const to of s.groups[k + 1]!) this.link(link, from.id, to.id);
        });
      } else if (s.kind === 'subgraph') {
        this.membership.openCluster(s.id, cluster);
        if (!this.subgraphs.has(s.id)) this.subgraphs.set(s.id, s.title);
        this.walk(s.stmts, s.id);
      } else if (s.kind === 'direction') {
        this.warnings.add('Mermaid subgraph directions were dropped; the page runs one way.');
      } else if (s.kind === 'classDef') {
        this.checkProps(s.props);
        for (const name of s.names) this.classDefs.set(name, [...(this.classDefs.get(name) ?? []), ...s.props]);
      } else if (s.kind === 'class') {
        for (const id of s.ids) this.addClass(id, s.className);
      } else if (s.kind === 'style') {
        this.checkProps(s.props);
        this.styles.set(s.id, [...(this.styles.get(s.id) ?? []), ...s.props]);
      } else if (s.kind === 'linkStyle') {
        this.checkProps(s.props);
        for (const i of s.indexes === 'default' ? ['default' as const] : s.indexes) {
          this.linkStyles.set(i, [...(this.linkStyles.get(i) ?? []), ...s.props]);
        }
      } else {
        this.warnings.list('Mermaid statements a diagram does not hold were dropped', s.keyword);
      }
    }
  }

  checkProps(props: StyleProps): void {
    checkProps(props, this.warnings);
  }

  propsOf(id: string, isNode: boolean): Map<string, string> {
    const props = new Map<string, string>();
    const lists = [isNode ? this.classDefs.get('default') : undefined, ...(this.classes.get(id) ?? []).map((c) => this.classDefs.get(c)), this.styles.get(id)];
    for (const list of lists) for (const [k, v] of list ?? []) props.set(k, v);
    return props;
  }
}


function edgeColors(base: Partial<EdgeStyle> | undefined, props: StyleProps): Partial<EdgeStyle> | undefined {
  const colors: Partial<EdgeStyle> = { ...base };
  for (const [k, v] of props) {
    if (k === 'stroke') colors.stroke = v;
    else if (k === 'color') colors.label = v;
    else if (k === 'stroke-width') colors.width = px(v);
    else if (k === 'stroke-dasharray') colors.dash = dashOf(v);
  }
  return Object.keys(colors).length > 0 ? colors : undefined;
}

function subgraphIdsOf(stmts: readonly MermaidStmt[], out = new Set<string>()): Set<string> {
  for (const s of stmts) if (s.kind === 'subgraph') subgraphIdsOf(s.stmts, out.add(s.id));
  return out;
}

/** Reads a Mermaid flowchart into a one-page document, its `notation` unset. Throws, naming the line, on text that is not one. */
export function readFlowchart(text: string): ImportResult {
  const chart = parseFlowchart(text);
  const r = new MermaidReader(subgraphIdsOf(chart.stmts));
  if (chart.directives > 0) r.warnings.add('Mermaid configuration directives were dropped.');
  r.walk(chart.stmts, null);
  const nodes: DataNode[] = [...r.nodes].map(([id, d]) => {
    const colors = nodeColors(r.propsOf(id, true));
    return { id, lines: d.lines, outline: d.outline, ...(colors !== undefined ? { colors } : {}) };
  });
  const edges = r.edges.map(({ edge, index }) => {
    const props = [...(r.linkStyles.get('default') ?? []), ...(r.linkStyles.get(index) ?? [])];
    const colors = edgeColors(edge.colors, props);
    const { colors: _c, ...rest } = edge;
    return colors !== undefined ? { ...rest, colors } : rest;
  });
  const containers: DataContainer[] = [...r.subgraphs].map(([id, title]) => {
    const members = r.membership.members(id);
    const colors = nodeColors(r.propsOf(id, false));
    return {
      id, role: 'container', label: title !== undefined ? textLines(title).join(' ') : id,
      ...(members.length > 0 ? { members } : {}),
      ...(colors !== undefined ? { colors } : {}),
    };
  });
  const page = graphPage({
    ...(chart.title !== undefined ? { name: chart.title } : {}),
    ...(DIRECTIONS[chart.direction] !== undefined ? { direction: DIRECTIONS[chart.direction] } : {}),
    nodes, edges, containers,
  });
  return { document: { pages: [page] }, warnings: r.warnings.all() };
}
