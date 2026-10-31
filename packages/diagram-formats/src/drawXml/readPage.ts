/** One draw-style graph model as a {@link DocumentPage}. */
import type { Vec2 } from '@weasel-js/core/math';
import type { DataContainer, DataEdge, DataGroup, DataLane, DataNode, DiagramData } from '@weasel-js/diagram';
import type { DocumentPage } from '../document';
import { PAGE_MARGIN } from '../pageLayout';
import { shiftData } from '../shiftData';
import { geometryOf, pointsOf, type RawCell } from './cells';
import { pageCells, type Box, type PageCells } from './pageCells';
import {
  edgeColorsOf, labelPlacementOf, nodeColorsOf, outlineOf, portAt, routerOf, textOf, valueLines, verticalAlignOf, type Warn,
} from './readStyle';

/** The ids a document has handed out, so a cell id an earlier page used is renamed rather than shared. */
export type IdSpace = Set<string>;

/** Where a page's name and size come from. */
export interface PageSource { id: string; name?: string; width?: number; height?: number }

const optional = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } =>
  (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };

/** A unique id for `cellId`: itself, else prefixed with its page's, else numbered. */
function claim(ids: IdSpace, cellId: string, pageId: string): string {
  let id = ids.has(cellId) ? `${pageId}:${cellId}` : cellId;
  for (let n = 2; ids.has(id); n++) id = `${pageId}:${cellId}-${n}`;
  ids.add(id);
  return id;
}

interface Reader { page: PageCells; idOf: ReadonlyMap<RawCell, string>; warn: Warn }

const labelOf = (cell: RawCell): string | undefined => {
  const text = valueLines(cell).join(' ');
  return text === '' ? undefined : text;
};

function readNode({ page, idOf, warn }: Reader, cell: RawCell): DataNode {
  const box = page.boxOf(cell);
  return {
    id: idOf.get(cell)!,
    outline: outlineOf(cell.style, warn),
    ...textOf(cell),
    at: { x: box.x, y: box.y },
    width: box.width,
    height: box.height,
    ...optional('verticalAlign', verticalAlignOf(cell.style)),
    ...optional('colors', nodeColorsOf(cell.style)),
  };
}

/** The shapes and containers sitting directly in `region`, past any groups between. */
function membersOf({ page, idOf }: Reader, region: RawCell): string[] {
  return page.cells
    .filter((c) => (page.kindOf(c) === 'shape' || page.kindOf(c) === 'container') && page.regionOf(c) === region)
    .map((c) => idOf.get(c)!);
}

function readRegion(r: Reader, cell: RawCell): DataContainer {
  const { page, idOf } = r;
  const id = idOf.get(cell)!;
  const box = page.boxOf(cell);
  const common = { id, ...optional('label', labelOf(cell)), box, ...optional('colors', nodeColorsOf(cell.style)) };
  if (page.kindOf(cell) === 'container') {
    const members = membersOf(r, cell);
    return { ...common, role: 'container', ...(members.length > 0 ? { members } : {}) };
  }
  const axis = cell.style.values.get('horizontal') === '0' ? 'y' : 'x';
  const start = (b: Box) => (axis === 'y' ? b.y : b.x);
  const lanes = page.childrenOf(cell.id).filter((c) => page.kindOf(c) === 'lane')
    .sort((p, q) => start(page.boxOf(p)) - start(page.boxOf(q)))
    .map((lane): DataLane => {
      const b = page.boxOf(lane);
      const members = membersOf(r, lane);
      return {
        id: idOf.get(lane)!, ...optional('label', labelOf(lane)), size: axis === 'y' ? b.height : b.width,
        ...(members.length > 0 ? { members } : {}), ...optional('colors', nodeColorsOf(lane.style)),
      };
    });
  return { ...common, role: 'pool', axis, lanes };
}

function readGroup({ page, idOf }: Reader, cell: RawCell): DataGroup | null {
  const members = page.childrenOf(cell.id).filter((c) => page.kindOf(c) === 'shape' || page.kindOf(c) === 'group').map((c) => idOf.get(c)!);
  return members.length === 0 ? null : { id: idOf.get(cell)!, members };
}

const moved = (p: Vec2, by: Vec2): Vec2 => ({ x: p.x + by.x, y: p.y + by.y });

function readEdge({ page, idOf, warn }: Reader, cell: RawCell, byCellId: ReadonlyMap<string, RawCell>): DataEdge | null {
  const end = (id: string | null) => {
    const target = id === null ? undefined : byCellId.get(id);
    return target === undefined || page.kindOf(target) === 'edge' || page.kindOf(target) === 'label' ? undefined : idOf.get(target);
  };
  const from = end(cell.source);
  const to = end(cell.target);
  if (from === undefined || to === undefined) {
    warn('Connectors with a loose end, or with an end on another connector, were left out.');
    return null;
  }
  const origin = page.originOf(cell.parent);
  const points = pointsOf(cell).map((p) => moved(p, origin));
  const children = page.childrenOf(cell.id).filter((c) => labelOf(c) !== undefined);
  const endOf = (c: RawCell) => {
    const g = geometryOf(c);
    return !g.relative ? null : g.x === -1 ? 'from' : g.x === 1 ? 'to' : null;
  };
  const ends = children.filter((c) => endOf(c) !== null);
  const labels = children.filter((c) => endOf(c) === null);
  const holder = labelOf(cell) !== undefined ? cell : labels[0];
  if (labels.length + (holder === cell ? 1 : 0) > 1) warn('Connectors with more than one label kept only the first.');
  const endLabels = Object.fromEntries(ends.map((c) => [endOf(c)!, labelOf(c)!]));
  return {
    id: idOf.get(cell)!, from, to, router: routerOf(cell.style),
    ...optional('fromPort', portAt(cell.style, 'exit')),
    ...optional('toPort', portAt(cell.style, 'entry')),
    ...(points.length > 0 ? { waypoints: points } : {}),
    ...(holder !== undefined ? { label: labelOf(holder)!, ...optional('labelPlacement', labelPlacementOf(holder, geometryOf(holder))) } : {}),
    ...(ends.length > 0 ? { endLabels } : {}),
    ...optional('colors', edgeColorsOf(cell.style, warn)),
  };
}

/** What sits left of or above the page moves onto it, and the page grows to hold what is on it. */
function fitted(data: DiagramData, src: PageSource): { data: DiagramData; width: number; height: number } {
  const boxes: Box[] = [
    ...data.nodes.map((n) => ({ ...n.at!, width: n.width ?? 0, height: n.height ?? 0 })),
    ...(data.containers ?? []).map((c) => c.box!),
  ];
  if (boxes.length === 0) return { data, width: src.width ?? 2 * PAGE_MARGIN, height: src.height ?? 2 * PAGE_MARGIN };
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const by = { x: minX < 0 ? PAGE_MARGIN - minX : 0, y: minY < 0 ? PAGE_MARGIN - minY : 0 };
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + by.x + PAGE_MARGIN;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + by.y + PAGE_MARGIN;
  return {
    data: shiftData(data, by),
    width: Math.max(src.width ?? 0, Math.ceil(right)),
    height: Math.max(src.height ?? 0, Math.ceil(bottom)),
  };
}

/** Reads one graph model as a page. Cell ids an earlier page claimed in `ids` are renamed. */
export function readPage(model: Element, src: PageSource, ids: IdSpace, warn: Warn): DocumentPage {
  const page = pageCells(model);
  const label = src.name !== undefined ? `"${src.name}"` : 'the page';
  if (page.layers > 1) warn(`The ${page.layers} layers on ${label} were merged into one.`);
  const idOf = new Map<RawCell, string>();
  for (const cell of page.cells) {
    if (page.kindOf(cell) !== 'layer' && page.kindOf(cell) !== 'label') idOf.set(cell, claim(ids, cell.id, src.id));
  }
  const reader: Reader = { page, idOf, warn };
  const byCellId = new Map(page.cells.map((c) => [c.id, c]));
  const of = (kind: string) => page.cells.filter((c) => page.kindOf(c) === kind);
  const groups = of('group').map((c) => readGroup(reader, c)).filter((g): g is DataGroup => g !== null);
  const containers = page.cells.filter((c) => page.kindOf(c) === 'container' || page.kindOf(c) === 'pool').map((c) => readRegion(reader, c));
  const data: DiagramData = {
    nodes: of('shape').map((c) => readNode(reader, c)),
    edges: of('edge').map((c) => readEdge(reader, c, byCellId)).filter((e): e is DataEdge => e !== null),
    ...(groups.length > 0 ? { groups } : {}),
    ...(containers.length > 0 ? { containers } : {}),
  };
  const fit = fitted(data, src);
  return { kind: 'graph', id: src.id, ...optional('name', src.name), width: fit.width, height: fit.height, data: fit.data };
}
