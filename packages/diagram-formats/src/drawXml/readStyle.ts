/** What one cell's style and value say in diagram terms: an outline, colors, text, a router, markers, ports. */
import type { MarkerRef } from '@weasel-js/core';
import {
  DEFAULT_PORTS, type DataNode, type DiagramLabel, type DiagramRouter, type EdgeStyle, type NodeStyle, type Outline, type Row,
  type RowTextStyle,
} from '@weasel-js/diagram';
import type { CellGeometry, RawCell } from './cells';
import { cellLines } from './cellText';
import { BOX_NAMES, ORTHOGONAL_EDGE_STYLES, SHAPES, STADIUM_ARC, markerOf } from './mapping';
import { hasStyleName, shapeOf, styleFlag, styleNumber, type CellStyle } from './style';

/** Records one sentence about what a file had that a diagram cannot hold. */
export type Warn = (message: string) => void;

/** The outline a vertex draws as. A shape it does not know is a rect, with a warning. */
export function outlineOf(style: CellStyle, warn: Warn): Outline {
  const shape = shapeOf(style);
  const known = SHAPES.find((s) => s.name === shape);
  if (known !== undefined) return known.outline;
  if (styleFlag(style, 'rounded') && (styleNumber(style, 'arcSize') ?? 0) >= STADIUM_ARC) return 'stadium';
  if (shape !== undefined && !BOX_NAMES.has(shape)) warn(`Shapes of kind "${shape}" were drawn as rects.`);
  return 'rect';
}

/** A color value: `none` is transparent, and `default` or nothing is unset. */
function colorOf(style: CellStyle, key: string, otherwise?: string): string | undefined {
  const raw = style.values.get(key);
  if (raw === undefined || raw === '' || raw === 'default') return otherwise;
  return raw === 'none' ? 'transparent' : raw;
}

function dashOf(style: CellStyle): number[] | undefined {
  if (!styleFlag(style, 'dashed')) return undefined;
  const pattern = (style.values.get('dashPattern') ?? '').split(/\s+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return pattern.length > 0 ? pattern : [3, 3];
}

const defined = <T extends object>(o: T): Partial<T> | undefined => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
  return Object.keys(out).length > 0 ? out : undefined;
};

/** The colors a vertex's style names. A text cell draws no fill or stroke unless it says otherwise. */
export function nodeColorsOf(style: CellStyle): Partial<NodeStyle> | undefined {
  const bare = hasStyleName(style, 'text') ? 'transparent' : undefined;
  return defined<NodeStyle>({
    fill: colorOf(style, 'fillColor', bare), stroke: colorOf(style, 'strokeColor', bare), text: colorOf(style, 'fontColor'),
    strokeWidth: styleNumber(style, 'strokeWidth'), dash: dashOf(style),
  });
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
  });
  if (style === undefined) return { lines };
  return { rows: lines.map((text): Row => ({ kind: 'label', text, style })) };
}

const VERTICAL: Readonly<Record<string, DataNode['verticalAlign']>> = { top: 'top', middle: 'center', bottom: 'bottom' };

/** Where a vertex's text sits, when its style says. */
export const verticalAlignOf = (style: CellStyle): DataNode['verticalAlign'] => VERTICAL[style.values.get('verticalAlign') ?? ''];

/** The router an edge style draws with. */
export function routerOf(style: CellStyle): DiagramRouter {
  if (styleFlag(style, 'curved')) return 'bezier';
  return ORTHOGONAL_EDGE_STYLES.has(style.values.get('edgeStyle') ?? '') ? 'orthogonal' : 'straight';
}

function markerAt(style: CellStyle, end: 'start' | 'end', warn: Warn): MarkerRef | null {
  const name = style.values.get(`${end}Arrow`) ?? (end === 'end' ? 'classic' : 'none');
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
    stroke: colorOf(style, 'strokeColor'), label: colorOf(style, 'fontColor'),
    width: styleNumber(style, 'strokeWidth'), dash: dashOf(style),
    markerStart: start === null ? undefined : start,
    markerEnd: end === 'arrow' ? undefined : end,
  } as EdgeStyle);
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

/** Where a label sits along its edge, from an edge or edge-label geometry: `x` runs from -1 to 1, and `y` is how far off the line. */
export function labelPlacementOf(cell: RawCell, geo: CellGeometry): DiagramLabel | undefined {
  const g = cell.geometry;
  if (g === null || (!g.hasAttribute('x') && !g.hasAttribute('y'))) return undefined;
  const fraction = Math.min(1, Math.max(0, geo.x / 2 + 0.5));
  const at = fraction === 0.5 ? 'mid' : fraction === 0 ? 'start' : fraction === 1 ? 'end' : fraction;
  return { at, ...(geo.y !== 0 ? { offset: geo.y } : {}) };
}
