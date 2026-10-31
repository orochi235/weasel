/**
 * A Mermaid block diagram as a one-page document laid out by `grid`: blocks
 * as nodes in the flowchart's shapes, nested `block … end` groups as
 * containers, and `columns`, spans, and `space`s as the page layout's grid.
 */
import type { MarkerRef } from '@weasel-js/core';
import type { DataContainer, DataEdge, DataNode, EdgeStyle, GridOptions, Outline } from '@weasel-js/diagram';
import type { ImportResult, PageLayout } from '../../document';
import { Warnings, graphPage } from '../../graphRead';
import { pageNameOf } from '../common/lines';
import { StyleSheet } from '../common/styles';
import { textLines } from '../common/text';
import { SHAPE_OUTLINES } from '../flowchart/read';
import { parseBlockDiagram, type BlockItem, type BlockLink, type BlockStmt } from './parse';

/** Between a block diagram's columns, and its rows. */
export const BLOCK_GAPS = { nodeGap: 24, rankGap: 40 } as const;

/** The id an anonymous `block … end` reads as: `block-` and its place among them. */
export const anonymousGroupId = (n: number): string => `block-${n}`;

interface Grid { columns: Record<string, number>; spans: Record<string, number>; skips: Record<string, number> }

class BlockReader {
  readonly warnings = new Warnings();
  readonly styles = new StyleSheet(this.warnings);
  readonly nodes = new Map<string, { lines: string[]; outline: Outline }>();
  readonly groups = new Map<string, string[]>();
  readonly edges: DataEdge[] = [];
  readonly grid: Grid = { columns: {}, spans: {}, skips: {} };
  top: number | undefined;
  anonymous = 0;

  /** Declares `item`, a new one as the next of `members`, its shape and text when it gives them. */
  block(item: BlockItem, members: string[]): void {
    let node = this.nodes.get(item.id);
    if (node === undefined) {
      node = { lines: [item.id], outline: 'rect' };
      this.nodes.set(item.id, node);
      members.push(item.id);
    }
    if (item.text !== undefined) node.lines = textLines(item.text);
    if (item.shape === 'arrow') this.warnings.add('Mermaid block arrows read as rectangles; their directions were dropped.');
    else if (item.shape !== undefined) node.outline = SHAPE_OUTLINES[item.shape] ?? this.unknownShape(item.shape);
    if (item.span !== undefined && item.span > 1) this.grid.spans[item.id] = item.span;
  }

  unknownShape(name: string): Outline {
    this.warnings.list('Mermaid shapes read as rectangles', name);
    return 'rect';
  }

  link(link: BlockLink, from: string, to: string): void {
    const colors: Partial<EdgeStyle> = {
      ...(link.stroke === 'dotted' ? { dash: [4, 4] } : {}),
      ...(link.stroke === 'thick' ? { width: 3 } : {}),
      ...(link.start ? { markerStart: 'arrow' as MarkerRef } : {}),
      ...(!link.end ? { markerEnd: null } : {}),
    };
    const label = link.text === undefined ? [] : textLines(link.text).filter((l) => l !== '');
    this.edges.push({ from, to, ...(label.length > 0 ? { label: label.join(' ') } : {}), ...(Object.keys(colors).length > 0 ? { colors } : {}) });
  }

  /** Reads `stmts` into `level`, whose items in order are `members`. */
  walk(stmts: readonly BlockStmt[], level: string | null, members: string[]): void {
    let skip = 0;
    for (const s of stmts) {
      if (s.kind === 'items') {
        for (const item of s.items) {
          if (item.kind === 'space') {
            skip += item.n;
            continue;
          }
          const fresh = !this.nodes.has(item.id);
          this.block(item, members);
          if (fresh && skip > 0) this.grid.skips[item.id] = skip;
          skip = 0;
        }
      } else if (s.kind === 'links') {
        for (const end of s.ends) if (!this.groups.has(end.id)) this.block(end, members);
        s.links.forEach((link, k) => this.link(link, s.ends[k]!.id, s.ends[k + 1]!.id));
      } else if (s.kind === 'group') {
        const id = s.id ?? anonymousGroupId(++this.anonymous);
        const inner: string[] = [];
        this.groups.set(id, inner);
        members.push(id);
        if (skip > 0) this.grid.skips[id] = skip;
        skip = 0;
        if (s.span !== undefined && s.span > 1) this.grid.spans[id] = s.span;
        this.walk(s.stmts, id, inner);
      } else if (s.kind === 'columns') {
        if (level === null) this.top = s.n;
        else if (s.n !== undefined) this.grid.columns[level] = s.n;
      } else if (s.kind === 'style') this.styles.statement(s.text);
      else this.warnings.list('Mermaid statements a diagram does not hold were dropped', s.keyword);
    }
    if (skip > 0) this.warnings.add('Mermaid spaces after the last block in a row of blocks were dropped.');
  }

  /** The page layout's grid, with only what was given. */
  layout(): PageLayout {
    const { columns, spans, skips } = this.grid;
    const grid: GridOptions = {
      ...(this.top !== undefined ? { columns: this.top } : {}),
      ...(Object.keys(columns).length > 0 ? { groupColumns: columns } : {}),
      ...(Object.keys(spans).length > 0 ? { spans } : {}),
      ...(Object.keys(skips).length > 0 ? { skips } : {}),
    };
    return { name: 'grid', options: { ...BLOCK_GAPS, grid } };
  }
}

/** Reads a Mermaid block diagram into a one-page document of `notation` `'block'`, laid out by `grid`. Throws, naming
 *  the line, on text that is not one. */
export function readBlockDiagram(text: string): ImportResult {
  const { source, stmts } = parseBlockDiagram(text);
  const r = new BlockReader();
  r.walk(stmts, null, []);
  const nodes: DataNode[] = [...r.nodes].map(([id, n]) => {
    const colors = r.styles.colorsOf(id);
    return { id, lines: n.lines, outline: n.outline, ...(colors !== undefined ? { colors } : {}) };
  });
  const containers: DataContainer[] = [...r.groups].map(([id, members]) => {
    const colors = r.styles.colorsOf(id);
    return { id, role: 'container', ...(members.length > 0 ? { members } : {}), ...(colors !== undefined ? { colors } : {}) };
  });
  const name = pageNameOf(source, r.warnings);
  const page = graphPage({ ...(name !== undefined ? { name } : {}), nodes, edges: r.edges, containers });
  return { document: { pages: [{ ...page, layout: r.layout(), notation: 'block' }] }, warnings: r.warnings.all() };
}
