/** One draw-style graph model as a {@link DocumentPage}. */
import type { Vec2 } from '@weasel-js/core/math';
import { freshId } from '@weasel-js/registry';
import type { DataContainer, DataEdge, DataCluster, DataLane, DataNode, DiagramData } from '@weasel-js/diagram';
import type { DocumentPage } from '../document';
import { PAGE_MARGIN } from '../pageLayout';
import { shiftData } from '../shiftData';
import { geometryOf, pointsOf, type RawCell } from './cells';
import { pageCells, type PageCells } from './pageCells';
import {
  edgeColorsOf, labelPlacementOf, nodeColorsOf, outlineOf, regionColorsOf, portAt, routerOf, textOf, valueLines, verticalAlignOf, type Warn,
} from './readStyle';
import type { Rect } from '@weasel-js/geom';

/** The ids a document has handed out, so a cell id an earlier page used is renamed rather than shared. */
export type IdSpace = Set<string>;

/** Where a page's name and size come from. */
export interface PageSource { id: string; name?: string; width?: number; height?: number }

const optional = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } =>
  (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };

/** A unique id for `cellId`: itself, else prefixed with its page's, else numbered. */
function claim(ids: IdSpace, cellId: string, pageId: string): string {
  const id = ids.has(cellId) ? freshId(`${pageId}:${cellId}`, ids, { from: 2, bare: true }) : cellId;
  ids.add(id);
  return id;
}

/** What a page's readers share. `idOf` names every vertex the page keeps; `claimId` names a kept connector. */
interface Reader { page: PageCells; idOf: ReadonlyMap<RawCell, string>; groups: ReadonlySet<RawCell>; claimId: (cell: RawCell) => string; warn: Warn }

/** A region, lane, or connector label: its value's lines, one per line. */
const labelOf = (cell: RawCell): string | undefined => {
  const text = valueLines(cell).join('\n');
  return text === '' ? undefined : text;
};

function readNode({ page, idOf, warn }: Reader, cell: RawCell): DataNode {
  const box = page.boxOf(cell);
  return {
    id: idOf.get(cell)!,
    outline: outlineOf(cell.style, warn, box),
    ...textOf(cell),
    at: { x: box.x, y: box.y },
    width: box.width,
    height: box.height,
    ...optional('verticalAlign', verticalAlignOf(cell.style)),
    ...optional('colors', nodeColorsOf(cell.style, warn)),
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
  const common = { id, ...optional('label', labelOf(cell)), box, ...optional('colors', regionColorsOf(cell.style, r.warn)) };
  if (page.kindOf(cell) === 'container') {
    const members = membersOf(r, cell);
    return { ...common, role: 'container', ...(members.length > 0 ? { members } : {}) };
  }
  const axis = cell.style.values.get('horizontal') === '0' ? 'y' : 'x';
  const start = (b: Rect) => (axis === 'y' ? b.y : b.x);
  const lanes = page.childrenOf(cell.id).filter((c) => page.kindOf(c) === 'lane')
    .sort((p, q) => start(page.boxOf(p)) - start(page.boxOf(q)))
    .map((lane): DataLane => {
      const b = page.boxOf(lane);
      const members = membersOf(r, lane);
      return {
        id: idOf.get(lane)!, ...optional('label', labelOf(lane)), size: axis === 'y' ? b.height : b.width,
        ...(members.length > 0 ? { members } : {}), ...optional('colors', regionColorsOf(lane.style, r.warn)),
      };
    });
  return { ...common, role: 'pool', axis, lanes };
}

const groupMembers = (page: PageCells, cell: RawCell, kept: (c: RawCell) => boolean): RawCell[] =>
  page.childrenOf(cell.id).filter((c) => page.kindOf(c) === 'shape' || (page.kindOf(c) === 'group' && kept(c)));

/** The group cells a page keeps: those holding a shape or a kept group, outside every container, pool and lane, whose
 *  shapes belong to the region alone. Warns of a group dropped from a region, and of one dropped for holding no shape. */
function keptGroups(page: PageCells, warn: Warn): Set<RawCell> {
  const seen = new Map<RawCell, boolean>();
  const kept = (cell: RawCell): boolean => {
    let keep = seen.get(cell);
    if (keep === undefined) {
      keep = page.regionOf(cell) === null && groupMembers(page, cell, kept).length > 0;
      seen.set(cell, keep);
    }
    return keep;
  };
  const groups = page.cells.filter((c) => page.kindOf(c) === 'group');
  if (groups.some((c) => page.regionOf(c) !== null)) warn('Groups inside a container or lane were dropped; their shapes stay in it.');
  if (groups.some((c) => page.regionOf(c) === null && !kept(c))) warn('Groups holding no shape were dropped.');
  return new Set(groups.filter(kept));
}

function readGroup({ page, idOf, groups }: Reader, cell: RawCell): DataCluster {
  return {
    id: idOf.get(cell)!, members: groupMembers(page, cell, (c) => groups.has(c)).map((c) => idOf.get(c)!), ...optional('label', labelOf(cell)),
  };
}

const moved = (p: Vec2, by: Vec2): Vec2 => ({ x: p.x + by.x, y: p.y + by.y });

function readEdge({ page, idOf, groups, claimId, warn }: Reader, cell: RawCell, byCellId: ReadonlyMap<string, RawCell>): DataEdge | null {
  const target = (id: string | null) => (id === null ? undefined : byCellId.get(id));
  const dropped = (c: RawCell | undefined) => c !== undefined && page.kindOf(c) === 'group' && !groups.has(c);
  const end = (c: RawCell | undefined) =>
    (c === undefined || dropped(c) || page.kindOf(c) === 'edge' || page.kindOf(c) === 'label' ? undefined : idOf.get(c));
  const from = end(target(cell.source));
  const to = end(target(cell.target));
  if (from === undefined || to === undefined) {
    if ([target(cell.source), target(cell.target)].some(dropped)) warn('Connectors ending on a dropped group were left out.');
    else warn('Connectors with a loose end, or with an end on another connector, were left out.');
    return null;
  }
  const origin = page.originOf(cell.parent);
  const points = pointsOf(cell).map((p) => moved(p, origin));
  const middle = (c: RawCell | undefined): Vec2 => {
    const b = c === undefined ? { x: 0, y: 0, width: 0, height: 0 } : page.boxOf(c);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const line = [middle(target(cell.source)), ...points, middle(target(cell.target))];
  const children = page.childrenOf(cell.id).filter((c) => labelOf(c) !== undefined);
  const endOf = (c: RawCell) => {
    const g = geometryOf(c);
    return !g.relative ? null : g.x === -1 ? 'from' : g.x === 1 ? 'to' : null;
  };
  const ends = children.filter((c) => endOf(c) !== null);
  const labels = children.filter((c) => endOf(c) === null);
  const holder = labelOf(cell) !== undefined ? cell : labels[0];
  if (labels.length + (holder === cell ? 1 : 0) > 1) warn('Connectors with more than one label kept only the first.');
  const endLabels: { from?: string; to?: string } = {};
  for (const c of ends) {
    const at = endOf(c)!;
    if (endLabels[at] === undefined) endLabels[at] = labelOf(c)!;
    else warn('Connectors with more than one label at an end kept only the first.');
  }
  return {
    id: claimId(cell), from, to, router: routerOf(cell.style),
    ...optional('fromPort', portAt(cell.style, 'exit', warn)),
    ...optional('toPort', portAt(cell.style, 'entry', warn)),
    ...(points.length > 0 ? { waypoints: points } : {}),
    ...(holder !== undefined ? { label: labelOf(holder)!, ...optional('labelPlacement', labelPlacementOf(holder, geometryOf(holder), line)) } : {}),
    ...(ends.length > 0 ? { endLabels } : {}),
    ...optional('colors', edgeColorsOf(cell.style, warn)),
  };
}

/** What sits left of or above the page moves onto it, waypoints among it, and the page grows to hold what is on it. */
function fitted(data: DiagramData, src: PageSource): { data: DiagramData; width: number; height: number } {
  const boxes: Rect[] = [
    ...data.nodes.map((n) => ({ ...n.at!, width: n.width ?? 0, height: n.height ?? 0 })),
    ...(data.containers ?? []).map((c) => c.box!),
    ...data.edges.flatMap((e) => (e.waypoints ?? []).map((p) => ({ ...p, width: 0, height: 0 }))),
  ];
  if (boxes.length === 0) return { data, width: src.width ?? 2 * PAGE_MARGIN, height: src.height ?? 2 * PAGE_MARGIN };
  const minX = boxes.reduce((m, b) => Math.min(m, b.x), Infinity);
  const minY = boxes.reduce((m, b) => Math.min(m, b.y), Infinity);
  const by = { x: minX < 0 ? PAGE_MARGIN - minX : 0, y: minY < 0 ? PAGE_MARGIN - minY : 0 };
  const right = boxes.reduce((m, b) => Math.max(m, b.x + b.width), -Infinity) + by.x + PAGE_MARGIN;
  const bottom = boxes.reduce((m, b) => Math.max(m, b.y + b.height), -Infinity) + by.y + PAGE_MARGIN;
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
  const kept = keptGroups(page, warn);
  // Only what the page keeps takes an id, so a dropped group or connector leaves its id to a later page.
  const idOf = new Map<RawCell, string>();
  for (const cell of page.cells) {
    const kind = page.kindOf(cell);
    if (kind === 'layer' || kind === 'label' || kind === 'edge' || (kind === 'group' && !kept.has(cell))) continue;
    idOf.set(cell, claim(ids, cell.id, src.id));
  }
  const reader: Reader = { page, idOf, groups: kept, claimId: (cell) => claim(ids, cell.id, src.id), warn };
  const byCellId = new Map(page.cells.map((c) => [c.id, c]));
  const of = (kind: string) => page.cells.filter((c) => page.kindOf(c) === kind);
  const groups = of('group').filter((c) => reader.groups.has(c)).map((c) => readGroup(reader, c));
  const containers = page.cells.filter((c) => page.kindOf(c) === 'container' || page.kindOf(c) === 'pool').map((c) => readRegion(reader, c));
  const data: DiagramData = {
    nodes: of('shape').map((c) => readNode(reader, c)),
    edges: of('edge').map((c) => readEdge(reader, c, byCellId)).filter((e): e is DataEdge => e !== null),
    ...(groups.length > 0 ? { clusters: groups } : {}),
    ...(containers.length > 0 ? { containers } : {}),
  };
  const fit = fitted(data, src);
  return { kind: 'graph', id: src.id, ...optional('name', src.name), width: fit.width, height: fit.height, data: fit.data };
}
