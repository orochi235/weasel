/** What one cell's style and value say in diagram terms: an outline, colors, text, a router, markers, ports. */
import type { MarkerRef } from '@weasel-js/core';
import {
  DEFAULT_PORTS, type DataNode, type DiagramLabel, type DiagramRouter, type EdgeStyle, type NodeStyle, type Outline, type Row,
  type RowTextStyle,
} from '@weasel-js/diagram';
import type { Vec2 } from '@weasel-js/core/math';
import { offsetOf, type CellGeometry, type RawCell } from './cells';
import { cellLines } from './cellText';
import { BOX_NAMES, ORTHOGONAL_EDGE_STYLES, STADIUM_ARC, markerOf, shapeEntry, turnedAway } from './mapping';
import { checkedColor } from '../colorCheck';
import { hasStyleName, shapeOf, styleFlag, styleNumber, type CellStyle } from './style';
import { getOwn } from '@weasel-js/registry';

/** Records one sentence about what a file had that a diagram cannot hold; with `item`, adds it to the one sentence that
 *  starts `message` and names every item. */
export type Warn = (message: string, item?: string) => void;

/** The outline a vertex draws as. A shape it does not know is a rect, and one its `direction` turns from how the diagram
 *  draws it is drawn unturned, each with a warning. */
export function outlineOf(style: CellStyle, warn: Warn): Outline {
  const shape = shapeOf(style);
  const known = shapeEntry(shape, (key) => style.values.get(key));
  if (known !== undefined) {
    if (turnedAway(known, style.values.get('direction'))) warn(`Shapes of kind "${shape}" turned another way were drawn as the diagram turns them.`);
    return known.outline;
  }
  if (styleFlag(style, 'rounded')) return (styleNumber(style, 'arcSize') ?? 0) >= STADIUM_ARC ? 'stadium' : 'roundRect';
  if (shape !== undefined && !BOX_NAMES.has(shape)) warn(`Shapes of kind "${shape}" were drawn as rects.`);
  return 'rect';
}

/** A color value: `none` is transparent, `default` or nothing is unset, and one a diagram cannot draw is dropped. */
function colorOf(style: CellStyle, key: string, warn: Warn, otherwise?: string): string | undefined {
  const raw = style.values.get(key);
  if (raw === undefined || raw === '' || raw === 'default') return otherwise;
  return raw === 'none' ? 'transparent' : checkedColor(raw, 'Draw-style XML', warn);
}

function dashOf(style: CellStyle): number[] | undefined {
  if (!styleFlag(style, 'dashed')) return undefined;
  const pattern = (style.values.get('dashPattern') ?? '').split(/\s+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return pattern.length > 0 ? pattern : [3, 3];
}

const defined = <T extends object>(o: { [K in keyof T]?: T[K] | undefined }): Partial<T> | undefined => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
  return Object.keys(out).length > 0 ? out : undefined;
};

/** The colors a vertex's style names. A text cell draws no fill or stroke unless it says otherwise. */
export function nodeColorsOf(style: CellStyle, warn: Warn): Partial<NodeStyle> | undefined {
  const bare = hasStyleName(style, 'text') ? 'transparent' : undefined;
  return defined<NodeStyle>({
    fill: colorOf(style, 'fillColor', warn, bare), stroke: colorOf(style, 'strokeColor', warn, bare), text: colorOf(style, 'fontColor', warn),
    strokeWidth: styleNumber(style, 'strokeWidth'), dash: dashOf(style),
  });
}

/** A container's, pool's, or lane's colors: a swimlane's body is its `swimlaneFillColor`, where it names one, and else its
 *  `fillColor`, which a draw app paints in the header. */
export function regionColorsOf(style: CellStyle, warn: Warn): Partial<NodeStyle> | undefined {
  const colors = nodeColorsOf(style, warn);
  const body = colorOf(style, 'swimlaneFillColor', warn);
  return body === undefined ? colors : { ...colors, fill: body };
}

/** A cell's value as text. */
export const valueLines = (cell: RawCell): string[] => cellLines(cell.value, styleFlag(cell.style, 'html'));

/** A vertex's text: plain lines, or label rows when its style sets a font. */
export function textOf(cell: RawCell): Pick<DataNode, 'lines' | 'rows'> {
  const lines = valueLines(cell);
  const fontStyle = styleNumber(cell.style, 'fontStyle');
  const style = defined<RowTextStyle>({
    fontSize: styleNumber(cell.style, 'fontSize'),
    fontFamily: cell.style.values.get('fontFamily') || undefined,
    bold: fontStyle !== undefined && (fontStyle & 1) === 1 ? true : undefined,
    italic: fontStyle !== undefined && (fontStyle & 2) === 2 ? true : undefined,
  });
  if (style === undefined) return { lines };
  return { rows: lines.map((text): Row => ({ kind: 'label', text, style })) };
}

const VERTICAL: Readonly<Record<string, DataNode['verticalAlign']>> = { top: 'top', middle: 'center', bottom: 'bottom' };

/** Where a vertex's text sits, when its style says, and not only because its shape is written that way. */
export function verticalAlignOf(style: CellStyle): DataNode['verticalAlign'] {
  const raw = style.values.get('verticalAlign') ?? '';
  const own = shapeEntry(shapeOf(style), (key) => style.values.get(key))?.write;
  if (own?.some((part) => Array.isArray(part) && part[0] === 'verticalAlign' && part[1] === raw)) return undefined;
  return getOwn(VERTICAL, raw);
}

/** The router an edge style draws with. */
export function routerOf(style: CellStyle): DiagramRouter {
  if (styleFlag(style, 'curved')) return 'bezier';
  return ORTHOGONAL_EDGE_STYLES.has(style.values.get('edgeStyle') ?? '') ? 'orthogonal' : 'straight';
}

/** The marker at one end. An end the style does not name is unset: the diagram's own, an arrow at the end and none at the
 *  start, as a color the style does not name is the theme's. */
function markerAt(style: CellStyle, end: 'start' | 'end', warn: Warn): MarkerRef | null {
  const name = style.values.get(`${end}Arrow`);
  if (name === undefined) return end === 'end' ? 'arrow' : null;
  const marker = markerOf(name, style.values.get(`${end}Fill`));
  if (marker !== undefined) return marker;
  warn(`Arrowheads of kind "${name}" were drawn as arrows.`);
  return 'arrow';
}

/** The stroke, label color, and markers an edge style names. Markers are kept only where they differ from a connector's own. */
export function edgeColorsOf(style: CellStyle, warn: Warn): Partial<EdgeStyle> | undefined {
  const start = markerAt(style, 'start', warn);
  const end = markerAt(style, 'end', warn);
  return defined<EdgeStyle>({
    stroke: colorOf(style, 'strokeColor', warn), label: colorOf(style, 'fontColor', warn),
    width: styleNumber(style, 'strokeWidth'), dash: dashOf(style),
    markerStart: start === null ? undefined : start,
    markerEnd: end === 'arrow' ? undefined : end,
  });
}

/** The compass port nearest an exit or entry point given as fractions of the box, or `undefined` for none. */
export function portAt(style: CellStyle, end: 'exit' | 'entry'): string | undefined {
  const u = styleNumber(style, `${end}X`);
  const v = styleNumber(style, `${end}Y`);
  if (u === undefined || v === undefined) return undefined;
  let best = DEFAULT_PORTS[0]!;
  for (const port of DEFAULT_PORTS) {
    if (Math.hypot(port.at.u - u, port.at.v - v) < Math.hypot(best.at.u - u, best.at.v - v)) best = port;
  }
  return best.id;
}

/** The point `fraction` of the way along `line`, by length, and the unit direction of the stretch it is on. */
function pointAlong(line: readonly Vec2[], fraction: number): { at: Vec2; dir: Vec2 } | undefined {
  const lengths = line.slice(1).map((b, i) => Math.hypot(b.x - line[i]!.x, b.y - line[i]!.y));
  const total = lengths.reduce((t, l) => t + l, 0);
  if (total === 0) return undefined;
  let left = fraction * total;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (l === 0 || (left > l && i < lengths.length - 1)) {
      left -= l;
      continue;
    }
    const a = line[i]!;
    const b = line[i + 1]!;
    const dir = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    const t = Math.min(left, l);
    return { at: { x: a.x + dir.x * t, y: a.y + dir.y * t }, dir };
  }
  return undefined;
}

/**
 * Where a label sits along its edge, from an edge or edge-label geometry: `x` runs from -1 to 1, and `y` is how far off the
 * line. A label dragged off its place has an `offset` point too, which a draw app adds to where `x` and `y` put it; then the
 * label sits on `line` (the edge's ends and bends, straight between) nearest that point, `offset` the part of it across.
 */
export function labelPlacementOf(cell: RawCell, geo: CellGeometry, line: readonly Vec2[] = []): DiagramLabel | undefined {
  const g = cell.geometry;
  const off = offsetOf(cell);
  const moved = off.x !== 0 || off.y !== 0;
  if (g === null || (!g.hasAttribute('x') && !g.hasAttribute('y') && !moved)) return undefined;
  const fraction = Math.min(1, Math.max(0, geo.x / 2 + 0.5));
  const anchor = moved ? pointAlong(line, fraction) : undefined;
  if (anchor !== undefined) {
    // As a draw app turns `y` off the line: to the left of the direction of travel, as `offset` is.
    const normal = { x: anchor.dir.y, y: -anchor.dir.x };
    const across = off.x * normal.x + off.y * normal.y;
    const along = off.x * anchor.dir.x + off.y * anchor.dir.y;
    const offset = geo.y + across;
    return { at: { near: { x: anchor.at.x + anchor.dir.x * along, y: anchor.at.y + anchor.dir.y * along } }, ...(offset !== 0 ? { offset } : {}) };
  }
  const at = fraction === 0.5 ? 'mid' : fraction === 0 ? 'start' : fraction === 1 ? 'end' : fraction;
  return { at, ...(geo.y !== 0 ? { offset: geo.y } : {}) };
}
