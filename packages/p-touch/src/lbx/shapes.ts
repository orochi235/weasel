/**
 * Draw commands as native `.lbx` objects: rectangles, open polylines, plain text boxes. Each mapper
 * returns undefined for a command it cannot state exactly, and the writer rasterizes that one.
 */
import { mat3, PATH_CMD_LENGTHS, PATH_L, PATH_M, type PolygonPath, maxOf, minOf } from '@weasel-js/geom';
import type { PathDrawCommand, TextDrawCommand } from '@weasel-js/renderer';
import type { ArrowStyle, HorizontalAlignment, LineObject, RectObject, TextObject, VerticalAlignment } from 'bil-lbx';
import { axisMap, fillColor, plainStroke, uniformScale, type DrawState } from './style';

const NO_PEN = { style: 'NULL' as const };
const NO_BRUSH = { style: 'NULL' as const };

/** An axis-aligned rect path, filled and stroked in solid colors, as a `draw:rect`. `[]` draws nothing. */
export function rectObject(cmd: PathDrawCommand, state: DrawState): RectObject[] | undefined {
  if (cmd.path.kind !== 'rect' || cmd.vertexColors) return undefined;
  const map = axisMap(state.transform);
  if (!map) return undefined;
  const fill = fillColor(cmd.fill, state.alpha);
  if (fill === undefined) return undefined;
  const scale = cmd.stroke?.paint === undefined ? map.sx : uniformScale(map);
  if (scale === undefined) return undefined;
  const stroke = plainStroke(cmd.stroke, state.alpha, scale);
  if (stroke === undefined || (stroke && stroke.join !== 'miter')) return undefined;
  if (fill === null && stroke === null) return [];
  const { path } = cmd;
  const x = Math.min(path.x, path.x + path.width);
  const y = Math.min(path.y, path.y + path.height);
  const width = Math.abs(path.width);
  const height = Math.abs(path.height);
  // P-touch draws the pen inside the object's frame, so the frame reaches the stroke's outer edge.
  const grow = stroke === null ? 0 : stroke.align === 'center' ? stroke.width / 2 : stroke.align === 'outer' ? stroke.width : 0;
  return [{
    type: 'rect',
    shape: 'RECTANGLE',
    position: {
      x: x * map.sx + map.tx - grow,
      y: y * map.sy + map.ty - grow,
      width: width * map.sx + grow * 2,
      height: height * map.sy + grow * 2,
    },
    pen: stroke === null ? NO_PEN : { style: 'INSIDEFRAME', widthX: stroke.width, widthY: stroke.width, color: stroke.color },
    brush: fill === null ? NO_BRUSH : { style: 'SOLID', color: fill },
  }];
}

/** The points of a path made of one `M` and its `L`s, or undefined for curves, closes or more subpaths. */
function polylinePoints(path: PolygonPath): { x: number; y: number }[] | undefined {
  if (path.corners?.some((c) => c !== null)) return undefined;
  const ox = path.origin?.x ?? 0;
  const oy = path.origin?.y ?? 0;
  const points: { x: number; y: number }[] = [];
  let at = 0;
  for (let i = 0; i < path.commands.length; i++) {
    const code = path.commands[i]!;
    if (code !== (i === 0 ? PATH_M : PATH_L)) return undefined;
    points.push({ x: path.coords[at]! + ox, y: path.coords[at + 1]! + oy });
    at += PATH_CMD_LENGTHS[code]!;
  }
  return points.length >= 2 ? points : undefined;
}

const ARROW_FOR_CAP: Record<'butt' | 'round' | 'square', ArrowStyle> = { butt: 'SQUARE', round: 'ROUND', square: 'SQUARE' };

/** An open polyline stroked in a solid color, unfilled, as a `draw:poly`. */
export function lineObject(cmd: PathDrawCommand, state: DrawState): LineObject | undefined {
  if (cmd.path.kind !== 'polygon' || cmd.vertexColors || cmd.fill?.paint !== undefined) return undefined;
  const map = axisMap(state.transform);
  const scale = map && uniformScale(map);
  if (!map || scale === undefined) return undefined;
  const local = polylinePoints(cmd.path);
  const stroke = plainStroke(cmd.stroke, state.alpha, scale);
  if (!local || !stroke || stroke.align !== 'center') return undefined;
  const points = local.map((p) => {
    const [x, y] = mat3.apply(state.transform, p.x, p.y);
    return { x, y };
  });
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = minOf(xs);
  const y = minOf(ys);
  const arrow = ARROW_FOR_CAP[stroke.cap];
  return {
    type: 'line',
    position: { x, y, width: maxOf(xs) - x, height: maxOf(ys) - y },
    points,
    arrowBegin: arrow,
    arrowEnd: arrow,
    pen: { style: 'SOLID', widthX: stroke.width, widthY: stroke.width, color: stroke.color },
    brush: NO_BRUSH,
  };
}

const H_ALIGN: Record<string, HorizontalAlignment> = { left: 'LEFT', start: 'LEFT', center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFY' };
const V_ALIGN: Record<string, VerticalAlignment> = { top: 'TOP', center: 'CENTER', bottom: 'BOTTOM' };

/**
 * Text in one face, size and solid color, laid in a box of known size, as a `text:text`. P-touch
 * sets it again with its own copy of the face, so the lines can break where the canvas did not.
 */
export function textObject(cmd: TextDrawCommand, state: DrawState): TextObject | undefined {
  const map = axisMap(state.transform);
  const scale = map && uniformScale(map);
  const boxWidth = cmd.width ?? cmd.maxWidth;
  if (!map || scale === undefined || boxWidth === undefined || cmd.height === undefined) return undefined;
  if (cmd.direction === 'rtl' || cmd.runs.length === 0) return undefined;
  const [first] = cmd.runs;
  let color: string | undefined;
  for (const run of cmd.runs) {
    if (run.fontFamily !== first!.fontFamily || run.fontSize !== first!.fontSize) return undefined;
    if (run.fontWeight !== first!.fontWeight || run.fontStyle !== first!.fontStyle) return undefined;
    if (run.underline !== first!.underline || run.strikethrough !== first!.strikethrough) return undefined;
    if (run.stroke?.paint !== undefined || run.overline || run.sizeMap || run.rotate) return undefined;
    if (run.letterSpacing !== 0 || run.baselineShift !== 0) return undefined;
    const hex = fillColor(run.fill, state.alpha);
    if (!hex || (color !== undefined && hex !== color)) return undefined;
    color = hex;
  }
  const align = cmd.justify ? 'justify' : (cmd.align ?? cmd.style.align ?? 'left');
  return {
    type: 'text',
    position: { x: cmd.x * map.sx + map.tx, y: cmd.y * map.sy + map.ty, width: boxWidth * scale, height: cmd.height * scale },
    font: { name: first!.fontFamily, size: first!.fontSize * scale, weight: first!.fontWeight, italic: first!.fontStyle === 'italic' },
    textStyle: { color, underline: first!.underline ? 1 : 0, strikeout: first!.strikethrough ? 1 : 0 },
    control: 'FIXEDFRAME',
    shrink: false,
    autoLF: cmd.maxWidth !== undefined,
    horizontalAlignment: H_ALIGN[align] ?? 'LEFT',
    verticalAlignment: V_ALIGN[cmd.verticalAlign ?? 'top'] ?? 'TOP',
    data: cmd.runs.map((run) => run.text).join(''),
  };
}
