/** The style string each kind of cell is written with: a shape, a region, a group, or an edge. */
import {
  EDGE_STROKE_WIDTH, LANE_STROKE_WIDTH, NODE_STROKE_WIDTH, dataEdgeStyle, dataNodeStyle, dataRegionStyle, type ContainerHeader, type DataContainer,
  type DataEdge, type DataLane, type DataNode, type DiagramTheme, type NodeStyle, type Row, type RowTextStyle,
} from '@weasel-js/diagram';
import { ownPorts } from '../graphWrite';
import { ROLE_KEY } from './cells';
import { rowLines } from '../rowLines';
import { SHAPES, STADIUM_ARC, markerStyle } from './mapping';
import type { Warn } from './readStyle';
import { writeStyle, type StylePart } from './style';

const colorValue = (color: string | undefined): string | undefined =>
  (color === undefined ? undefined : color === 'transparent' ? 'none' : color);

const dashParts = (dash: readonly number[] | undefined): StylePart[] =>
  (dash !== undefined && dash.length > 0 ? [['dashed', 1], ['dashPattern', dash.join(' ')]] : []);

function colorParts(style: NodeStyle, fill: boolean): StylePart[] {
  return [
    ['fillColor', fill ? colorValue(style.fill) : 'none'], ['strokeColor', colorValue(style.stroke)],
    ['fontColor', colorValue(style.text)], ['strokeWidth', style.strokeWidth ?? NODE_STROKE_WIDTH], ...dashParts(style.dash),
  ];
}

function outlineParts(node: DataNode, warn: Warn): StylePart[] {
  const outline = node.outline ?? 'rect';
  if (outline === 'stadium') return [['rounded', 1], ['arcSize', STADIUM_ARC]];
  if (outline === 'roundRect') return [['rounded', 1]];
  const shape = SHAPES.find((s) => s.outline === outline && s.write !== undefined);
  if (shape?.write !== undefined) return shape.write as StylePart[];
  if (typeof outline !== 'string') warn('Shapes drawn with an outline path of their own were written as rects.');
  else if (outline !== 'rect') warn(`Shapes of kind "${outline}" were written as rects.`);
  return [['rounded', 0]];
}

/** A node's text, one line per row; rows that hold no text are left out, with a warning. */
export function nodeLines(node: DataNode, warn: Warn): string[] {
  return rowLines(node, () => warn('Port rows and slots inside shapes were left out.'));
}

/** The weight at and past which a numeric `weight` draws bold, as CSS's `bolder` steps past normal. */
const BOLD_WEIGHT = 600;

/** draw-style XML's `fontStyle`: bit 1 bold, bit 2 italic. A `weight` decides bold over `bold`, as the diagram draws it. */
function fontBits(style: RowTextStyle): number | undefined {
  const bold = style.weight !== undefined ? style.weight >= BOLD_WEIGHT : style.bold === true;
  const bits = (bold ? 1 : 0) | (style.italic === true ? 2 : 0);
  return bits === 0 ? undefined : bits;
}

const fontOf = (style: RowTextStyle | undefined): StylePart[] =>
  (style === undefined ? [] : [['fontSize', style.fontSize], ['fontFamily', style.fontFamily], ['fontStyle', fontBits(style)]]);

/** The weights `fontStyle` holds exactly: regular, and bold. */
const WRITTEN_WEIGHTS: ReadonlySet<number> = new Set([400, 700]);

/** The font of a shape's first text row, which a cell's one style gives every line; rows styled apart warn, as do
 *  tracking and weights other than regular and bold, which the format has no key for. */
function fontParts(rows: readonly Row[] | undefined, warn: Warn): StylePart[] {
  const styles = (rows ?? []).flatMap((r) => (r.kind === 'label' || r.kind === 'header' || r.kind === 'field' ? [r.style] : []));
  const keyOf = (s: RowTextStyle | undefined): string =>
    `${writeStyle(fontOf(s))}|${s?.tracking ?? 0}|${s?.weight ?? (s?.bold === true ? 700 : 400)}`;
  if (styles.some((s) => keyOf(s) !== keyOf(styles[0]))) warn('Text rows styled apart within one shape were written in its first row\'s style.');
  if (styles.some((s) => (s?.tracking ?? 0) !== 0)) warn('Letter spacing on text rows was left out.');
  if (styles.some((s) => s?.weight !== undefined && !WRITTEN_WEIGHTS.has(s.weight))) {
    warn('Font weights other than regular and bold were written as the nearer of the two.');
  }
  return fontOf(styles[0]);
}

const VERTICAL: Readonly<Record<string, string>> = { top: 'top', center: 'middle', bottom: 'bottom' };

/** A shape's style: its outline, its colors under `theme`, its font, and where its text sits. */
export function nodeStyle(node: DataNode, theme: DiagramTheme, warn: Warn): string {
  if ((node.marks ?? []).length > 0) warn('Marks drawn over shapes were left out.');
  if (ownPorts(node)) warn('Ports of a shape\'s own, and port labels, were left out; connectors meeting them were written meeting the shape where the port sat.');
  return writeStyle([
    ...outlineParts(node, warn), ['whiteSpace', 'wrap'],
    ...colorParts(dataNodeStyle(node, theme), true), ...fontParts(node.rows, warn),
    ['verticalAlign', node.verticalAlign === undefined ? undefined : VERTICAL[node.verticalAlign]],
  ]);
}

/** A container's, pool's, or lane's style: a swimlane whose header is on the side `header` says, `startSize` deep. A draw app
 *  fills a swimlane's header from `fillColor` and its body from `swimlaneFillColor`; the diagram fills both, but a lane not at all. */
export function regionStyle(region: DataContainer | (DataLane & { role: 'lane' }), header: ContainerHeader | undefined,
  theme: DiagramTheme, laneIndex = 0): string {
  const style = dataRegionStyle({ role: region.role, style: 'style' in region ? region.style : undefined, colors: region.colors }, theme, laneIndex);
  const lane = region.role === 'lane';
  return writeStyle([
    'swimlane', ['horizontal', header?.side === 'left' ? 0 : 1], ['startSize', header?.size ?? 0],
    ['container', 1], ['collapsible', 0], ['whiteSpace', 'wrap'],
    // The diagram outlines every region undashed, whatever its style says.
    ...colorParts({ ...style, dash: undefined, ...(lane ? { strokeWidth: LANE_STROKE_WIDTH } : {}) }, !lane),
    ['swimlaneFillColor', lane ? 'none' : colorValue(style.fill)], [ROLE_KEY, lane ? undefined : region.role],
  ]);
}

/** A group's style: a box drawn as nothing, around what it holds. */
export const GROUP_STYLE = writeStyle(['group']);

function markerParts(end: 'start' | 'end', marker: Parameters<typeof markerStyle>[0], warn: Warn): StylePart[] {
  let style = markerStyle(marker);
  if (style === undefined) {
    warn('Markers the format has no arrowhead like were written as arrows.');
    style = markerStyle('arrow')!;
  }
  return [[`${end}Arrow`, style[0]], [`${end}Fill`, style[0] === 'none' ? undefined : style[1]]];
}

/** An edge's style, less its ports: its router, its stroke and label color under `theme`, and its markers. */
export function edgeStyle(edge: DataEdge, theme: DiagramTheme, warn: Warn): StylePart[] {
  const style = dataEdgeStyle(edge, theme);
  const router = edge.router ?? 'straight';
  if (style.trim !== undefined) warn('Trims on connectors were left out; they were written whole.');
  if (router === 'avoid') warn('Connectors routed around shapes were written as orthogonal connectors.');
  return [
    ['edgeStyle', router === 'orthogonal' || router === 'avoid' ? 'orthogonalEdgeStyle' : 'none'],
    ['curved', router === 'bezier' ? 1 : undefined], ['rounded', 0], ['html', 0],
    ['strokeColor', colorValue(style.stroke)], ['strokeWidth', style.width ?? EDGE_STROKE_WIDTH], ...dashParts(style.dash),
    ['fontColor', colorValue(style.label ?? style.stroke)],
    ...markerParts('start', style.markerStart ?? null, warn),
    ...markerParts('end', style.markerEnd === undefined ? 'arrow' : style.markerEnd, warn),
  ];
}
