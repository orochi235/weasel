/** One page of a document as a draw-style `<diagram>`: its shapes, regions, and groups as nested cells, then its edges. */
import { IDENTITY_POSE_COMPOSITION, pageName } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import {
  diagramScene, type ContainerHeader, type DataContainer, type DiagramData, type DiagramTheme,
} from '@weasel-js/diagram';
import type { GraphPage } from '../document';
import { laidOutPage, needsLayout } from '../pageLayout';
import type { Box } from './pageCells';
import type { Warn } from './readStyle';
import { writeEdge } from './writeEdge';
import { GROUP_STYLE, nodeLines, nodeStyle, regionStyle } from './writeStyle';
import { attrs, vertexXml } from './writeXml';

/** A vertex to write: its cell, less the parent and box the tree gives it. */
interface Vertex { id: string; value: string; style: string; group?: boolean }

/**
 * Which cell holds each item: a container its members, a pool its lanes, a
 * lane its members, and a group what no region holds. An earlier claim wins,
 * and a claim that would put a cell inside itself is ignored.
 */
function parentsOf(data: DiagramData, known: ReadonlySet<string>, warn: Warn): Map<string, string> {
  const parent = new Map<string, string>();
  const within = (id: string, of: string): boolean => {
    for (let up: string | undefined = of; up !== undefined; up = parent.get(up)) if (up === id) return true;
    return false;
  };
  const claim = (member: string, holder: string): boolean => {
    if (!known.has(member) || parent.has(member) || within(member, holder)) return false;
    parent.set(member, holder);
    return true;
  };
  for (const c of data.containers ?? []) {
    for (const m of c.members ?? []) claim(m, c.id);
    for (const lane of c.lanes ?? []) {
      claim(lane.id, c.id);
      for (const m of lane.members ?? []) claim(m, lane.id);
    }
  }
  for (const g of data.groups ?? []) {
    const held = new Set(g.members.map((m) => parent.get(m)));
    const region = held.size === 1 ? [...held][0] : undefined;
    if (region !== undefined && !parent.has(g.id) && !within(g.id, region)) {
      parent.set(g.id, region);
      for (const m of g.members) parent.delete(m);
    } else if (g.members.some((m) => parent.has(m))) {
      warn('Groups reaching into a container or lane kept only the members outside it.');
    }
    for (const m of g.members) claim(m, g.id);
  }
  return parent;
}

const union = (boxes: readonly Box[]): Box | undefined => {
  if (boxes.length === 0) return undefined;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
};

/** An id no item on the page has, for the root and layer cells every graph model has. */
function freeId(want: string, taken: ReadonlySet<string>): string {
  let id = want;
  for (let n = 2; taken.has(id); n++) id = `${want}-${n}`;
  return id;
}

const regionLabel = (c: { label?: string }): string => c.label ?? '';

function vertices(data: DiagramData, theme: DiagramTheme, headerOf: (id: string) => ContainerHeader | undefined, warn: Warn): Vertex[] {
  const out: Vertex[] = [];
  const pools: DataContainer[] = [];
  for (const c of data.containers ?? []) {
    out.push({ id: c.id, value: regionLabel(c), style: regionStyle(c, headerOf(c.id), theme) });
    if (c.role === 'pool') pools.push(c);
  }
  for (const pool of pools) {
    (pool.lanes ?? []).forEach((lane, i) => {
      out.push({ id: lane.id, value: regionLabel(lane), style: regionStyle({ ...lane, role: 'lane' }, headerOf(lane.id), theme, i) });
    });
  }
  for (const g of data.groups ?? []) out.push({ id: g.id, value: '', style: GROUP_STYLE, group: true });
  for (const n of data.nodes) out.push({ id: n.id, value: nodeLines(n, warn).join('\n'), style: nodeStyle(n, theme, warn) });
  return out;
}

/**
 * Writes `page`, the `index`th, as a `<diagram>` element. A page with
 * unplaced nodes is laid out first, as an import would. A node is written the
 * size it states, which is its drawn size in a document read from a scene;
 * anything else the size `diagramScene` gives it with estimated text.
 */
export function writePage(page: GraphPage, index: number, theme: DiagramTheme, warn: Warn): string {
  const laid = needsLayout(page) ? laidOutPage(page, { theme }) : page;
  const { data } = laid;
  // In world: the tree below makes each box relative to the cell holding it.
  const specs = new Map(diagramScene(data, { layout: 'none', theme, composition: IDENTITY_POSE_COMPOSITION }).map((s) => [s.id as string, s]));
  const headerOf = (id: string) => (specs.get(id)?.data.diagram as { container?: { header?: ContainerHeader } } | undefined)?.container?.header;
  const items = vertices(data, theme, headerOf, warn);
  const ids = new Set(items.map((v) => v.id));
  const parent = parentsOf(data, ids, warn);
  const children = new Map<string | undefined, Vertex[]>();
  for (const v of items) children.set(parent.get(v.id), [...(children.get(parent.get(v.id)) ?? []), v]);

  const nodes = new Map(data.nodes.map((n) => [n.id, n]));
  const boxes = new Map<string, Box>();
  const boxOf = (v: Vertex): Box | undefined => {
    if (!boxes.has(v.id)) {
      const pose = specs.get(v.id)?.pose;
      const node = nodes.get(v.id);
      const box = v.group === true ? union((children.get(v.id) ?? []).map(boxOf).filter((b): b is Box => b !== undefined))
        : pose === undefined ? undefined
          : { x: pose.x, y: pose.y, width: node?.width ?? pose.width, height: node?.height ?? pose.height };
      if (box !== undefined) boxes.set(v.id, box);
    }
    return boxes.get(v.id);
  };
  const root = freeId('0', ids);
  const layer = freeId('1', new Set([...ids, root]));
  let cells = '';
  const emit = (holder: string | undefined, holderCell: string, origin: Vec2): void => {
    for (const v of children.get(holder) ?? []) {
      const box = boxOf(v);
      if (box === undefined) {
        emit(v.id, holderCell, origin);
        continue;
      }
      cells += vertexXml({ ...v, parent: holderCell }, box, origin);
      emit(v.id, v.id, box);
    }
  };
  emit(undefined, layer, { x: 0, y: 0 });
  const edgePage = { theme, layer, nodes, boxes, warn };
  for (const edge of data.edges) cells += writeEdge(edge, edgePage) ?? '';

  const model = attrs([
    ['grid', '1'], ['gridSize', '10'], ['page', '1'], ['pageScale', '1'], ['pageWidth', laid.width], ['pageHeight', laid.height],
  ]);
  return `  <diagram${attrs([['id', page.id], ['name', pageName(page, index)]])}>\n    <mxGraphModel${model}>\n      <root>\n`
    + `        <mxCell${attrs([['id', root]])} />\n        <mxCell${attrs([['id', layer], ['parent', root]])} />\n`
    + `${cells}      </root>\n    </mxGraphModel>\n  </diagram>\n`;
}
