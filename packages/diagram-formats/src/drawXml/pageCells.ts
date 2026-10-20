/**
 * A graph model's cells sorted into what a diagram holds — shapes, containers,
 * pools, lanes, groups, edges, and edge labels — with their boxes on the page.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { cellsOf, geometryOf, type RawCell } from './cells';
import { hasStyleName, styleFlag, styleNumber } from './style';

/** What a cell is to a diagram. `layer` covers the root and the layers, which hold the rest. */
export type CellKind = 'layer' | 'shape' | 'container' | 'pool' | 'lane' | 'group' | 'edge' | 'label';

/** A box on the page. */
export interface Box { x: number; y: number; width: number; height: number }

/** A page's cells, sorted, and how to place them. */
export interface PageCells {
  cells: readonly RawCell[];
  kindOf(cell: RawCell): CellKind;
  /** Vertex children of a cell, in document order. */
  childrenOf(id: string): readonly RawCell[];
  /** The page point a cell's children measure from: the corner of every vertex above it. */
  originOf(id: string | null): Vec2;
  /** A vertex's box on the page. */
  boxOf(cell: RawCell): Box;
  /** The container, pool, or lane a cell sits in, through any groups and shapes between, or `null`. */
  regionOf(cell: RawCell): RawCell | null;
  /** How many layers the page has. */
  layers: number;
}

/** Lanes span a pool's body across its stack; a swimlane holding swimlanes that do not is a container of containers. */
const SPAN = 0.9;

const isSwimlane = (cell: RawCell): boolean => hasStyleName(cell.style, 'swimlane');

/** Whether a swimlane's swimlane children are its lanes. */
function holdsLanes(cell: RawCell, children: readonly RawCell[]): boolean {
  const lanes = children.filter(isSwimlane);
  if (lanes.length === 0) return false;
  const box = geometryOf(cell);
  const head = styleNumber(cell.style, 'startSize') ?? 0;
  const rows = cell.style.values.get('horizontal') === '0';
  const across = rows ? box.width - head : box.height - head;
  return lanes.every((lane) => (rows ? geometryOf(lane).width : geometryOf(lane).height) >= across * SPAN);
}

/** Sorts a graph model's cells. */
export function pageCells(model: Element): PageCells {
  const cells = cellsOf(model);
  const byId = new Map(cells.map((c) => [c.id, c]));
  const children = new Map<string, RawCell[]>();
  for (const cell of cells) {
    if (!cell.vertex || cell.parent === null) continue;
    children.set(cell.parent, [...(children.get(cell.parent) ?? []), cell]);
  }
  const childrenOf = (id: string): readonly RawCell[] => children.get(id) ?? [];
  const kinds = new Map<RawCell, CellKind>();
  const kindOf = (cell: RawCell): CellKind => {
    let kind = kinds.get(cell);
    if (kind === undefined) {
      kind = classify(cell);
      kinds.set(cell, kind);
    }
    return kind;
  };
  const classify = (cell: RawCell): CellKind => {
    if (cell.edge) return 'edge';
    if (!cell.vertex) return 'layer';
    const parent = cell.parent === null ? undefined : byId.get(cell.parent);
    if (parent?.edge === true) return 'label';
    if (hasStyleName(cell.style, 'group')) return 'group';
    if (isSwimlane(cell)) {
      if (parent !== undefined && kindOf(parent) === 'pool') return 'lane';
      return holdsLanes(cell, childrenOf(cell.id)) ? 'pool' : 'container';
    }
    return styleFlag(cell.style, 'container') ? 'container' : 'shape';
  };

  const origins = new Map<string, Vec2>();
  const originOf = (id: string | null): Vec2 => {
    const cell = id === null ? undefined : byId.get(id);
    if (cell === undefined || !cell.vertex || kindOf(cell) === 'label') return { x: 0, y: 0 };
    let origin = origins.get(cell.id);
    if (origin === undefined) {
      const up = originOf(cell.parent);
      const g = geometryOf(cell);
      origin = { x: up.x + g.x, y: up.y + g.y };
      origins.set(cell.id, origin);
    }
    return origin;
  };
  const boxOf = (cell: RawCell): Box => {
    const { x, y } = originOf(cell.id);
    const g = geometryOf(cell);
    return { x, y, width: g.width, height: g.height };
  };
  const regionOf = (cell: RawCell): RawCell | null => {
    for (let up = byId.get(cell.parent ?? ''); up !== undefined; up = byId.get(up.parent ?? '')) {
      const kind = kindOf(up);
      if (kind === 'container' || kind === 'pool' || kind === 'lane') return up;
      if (kind !== 'group' && kind !== 'shape') return null;
    }
    return null;
  };
  const layers = cells.filter((c) => !c.vertex && !c.edge && c.parent !== null && byId.get(c.parent)?.parent === null).length;
  return { cells, kindOf, childrenOf, originOf, boxOf, regionOf, layers };
}
