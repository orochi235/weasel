/** The cells of a draw-style graph model, read off its XML as they are, before they mean anything to a diagram. */
import type { Vec2 } from '@weasel-js/core/math';
import { freshId } from '@weasel-js/registry';
import { parseStyle, styleFlag, type CellStyle } from './style';

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

const idAttr = (outer: Element, cell: Element): string | null => outer.getAttribute('id') ?? cell.getAttribute('id');

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A wrapper's label with each `%name%` its `placeholders="1"` asks for filled from the wrapper's own attribute of that
 *  name, as a draw app shows it; a name it has no attribute for, `label`, and `tooltip` stay as written. In an `html`
 *  label a value is text, so it is escaped. */
function filled(outer: Element, label: string, html: boolean): string {
  if (outer.getAttribute('placeholders') !== '1') return label;
  return label.replace(/%([^%]+)%/g, (whole, name: string) => {
    const value = name === 'label' || name === 'tooltip' ? null : outer.getAttribute(name);
    return value === null ? whole : html ? escapeHtml(value) : value;
  });
}

function rawCell(outer: Element, cell: Element, id: string): RawCell {
  const wrapped = outer !== cell;
  const style = parseStyle(cell.getAttribute('style'));
  const value = wrapped ? filled(outer, outer.getAttribute('label') ?? '', styleFlag(style, 'html')) : cell.getAttribute('value') ?? '';
  return {
    id,
    parent: cell.getAttribute('parent'),
    value,
    style,
    vertex: cell.getAttribute('vertex') === '1',
    edge: cell.getAttribute('edge') === '1',
    source: cell.getAttribute('source'),
    target: cell.getAttribute('target'),
    geometry: childElements(cell).find((c) => c.tagName === 'mxGeometry') ?? null,
  };
}

/** The cells under a graph model's `root`, in document order. A cell with no id is given `cell-<n>`, numbered on past
 *  any id the model holds, so it is never taken for another cell. */
export function cellsOf(model: Element): RawCell[] {
  const root = childElements(model).find((c) => c.tagName === 'root');
  if (root === undefined) return [];
  const found: [Element, Element][] = [];
  for (const el of childElements(root)) {
    if (el.tagName === 'mxCell') found.push([el, el]);
    else if (WRAPPERS.has(el.tagName)) {
      const inner = childElements(el).find((c) => c.tagName === 'mxCell');
      if (inner !== undefined) found.push([el, inner]);
    }
  }
  const taken = new Set(found.map(([outer, cell]) => idAttr(outer, cell)).filter((id): id is string => id !== null));
  return found.map(([outer, cell], i) => {
    let id = idAttr(outer, cell);
    if (id === null) {
      id = freshId(`cell-${i + 1}`, taken, { from: 2, bare: true });
      taken.add(id);
    }
    return rawCell(outer, cell, id);
  });
}

/** A cell's geometry. A missing one is an empty box at the origin. A negative width or height
 *  reaches back from `x` or `y`, as a draw app renders it, so it reads as that box; a relative
 *  geometry's `x` and `y` are fractions, along an edge or of a parent vertex's box, and stay as written. */
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

/** A geometry's `offset` point: how far a relative cell sits from where its fractions put it, or a label from its anchor. */
export function offsetOf(cell: RawCell): Vec2 {
  const p = cell.geometry === null ? undefined
    : childElements(cell.geometry).find((c) => c.tagName === 'mxPoint' && c.getAttribute('as') === 'offset');
  return { x: numberAttr(p ?? null, 'x'), y: numberAttr(p ?? null, 'y') };
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

/** The style key holding whether a swimlane is a pool or a container, which its shape alone cannot say. A draw app does
 *  not know it, so it ignores it. */
export const ROLE_KEY = 'weaselRole';
