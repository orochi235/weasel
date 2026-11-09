/** The cells of a draw-style graph model, read off its XML as they are, before they mean anything to a diagram. */
import type { Vec2 } from '@weasel-js/core/math';
import { parseStyle, type CellStyle } from './style';

/** One cell element, with a wrapper's id and label read in. */
export interface RawCell {
  id: string;
  parent: string | null;
  value: string;
  style: CellStyle;
  vertex: boolean;
  edge: boolean;
  source: string | null;
  target: string | null;
  geometry: Element | null;
}

/** A cell's geometry: its box, relative to its parent's origin, and whether it is a fraction along an edge instead. */
export interface CellGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  relative: boolean;
}

/** The elements that wrap a cell to give it properties of its own, holding its id and its label. */
const WRAPPERS = new Set(['UserObject', 'object']);

const numberAttr = (el: Element | null, name: string): number => {
  const n = Number(el?.getAttribute(name) ?? '0');
  return Number.isFinite(n) ? n : 0;
};

const childElements = (el: Element): Element[] => Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

function rawCell(outer: Element, cell: Element, index: number): RawCell {
  const wrapped = outer !== cell;
  const id = outer.getAttribute('id') ?? cell.getAttribute('id') ?? `cell-${index + 1}`;
  const value = wrapped ? outer.getAttribute('label') ?? '' : cell.getAttribute('value') ?? '';
  return {
    id,
    parent: cell.getAttribute('parent'),
    value,
    style: parseStyle(cell.getAttribute('style')),
    vertex: cell.getAttribute('vertex') === '1',
    edge: cell.getAttribute('edge') === '1',
    source: cell.getAttribute('source'),
    target: cell.getAttribute('target'),
    geometry: childElements(cell).find((c) => c.tagName === 'mxGeometry') ?? null,
  };
}

/** The cells under a graph model's `root`, in document order. */
export function cellsOf(model: Element): RawCell[] {
  const root = childElements(model).find((c) => c.tagName === 'root');
  if (root === undefined) return [];
  const out: RawCell[] = [];
  for (const el of childElements(root)) {
    if (el.tagName === 'mxCell') out.push(rawCell(el, el, out.length));
    else if (WRAPPERS.has(el.tagName)) {
      const inner = childElements(el).find((c) => c.tagName === 'mxCell');
      if (inner !== undefined) out.push(rawCell(el, inner, out.length));
    }
  }
  return out;
}

/** A cell's geometry. A missing one is an empty box at the origin. A negative width or height
 *  reaches back from `x` or `y`, as a draw app renders it, so it reads as that box; a relative
 *  geometry's `x` and `y` place it along an edge, and stay as written. */
export function geometryOf(cell: RawCell): CellGeometry {
  const g = cell.geometry;
  const width = numberAttr(g, 'width');
  const height = numberAttr(g, 'height');
  const relative = g?.getAttribute('relative') === '1';
  return {
    x: numberAttr(g, 'x') + (relative ? 0 : Math.min(0, width)),
    y: numberAttr(g, 'y') + (relative ? 0 : Math.min(0, height)),
    width: Math.abs(width), height: Math.abs(height),
    relative,
  };
}

/** An edge geometry's bend points, relative to its parent's origin. */
export function pointsOf(cell: RawCell): Vec2[] {
  const array = cell.geometry === null ? undefined
    : childElements(cell.geometry).find((c) => c.tagName === 'Array' && c.getAttribute('as') === 'points');
  if (array === undefined) return [];
  return childElements(array).filter((p) => p.tagName === 'mxPoint').map((p) => ({ x: numberAttr(p, 'x'), y: numberAttr(p, 'y') }));
}

/** The graph model attribute holding the way the page runs. A draw app does not know it, so it ignores it. */
export const DIRECTION_ATTR = 'weaselDirection';
