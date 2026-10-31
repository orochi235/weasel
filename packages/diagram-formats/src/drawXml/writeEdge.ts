/** One edge of a page as a draw-style edge cell. */
import type { Vec2 } from '@weasel-js/core/math';
import {
  DEFAULT_PORTS, edgeIdOf, endLabelIdOf, type DataEdge, type DataNode, type DiagramLabel, type DiagramTheme,
} from '@weasel-js/diagram';
import type { Box } from './pageCells';
import type { Warn } from './readStyle';
import { writeStyle, type StylePart } from './style';
import { edgeStyle } from './writeStyle';
import { edgeXml, endLabelXml } from './writeXml';

/** What an edge needs of the page it is on. */
export interface EdgePage {
  theme: DiagramTheme;
  layer: string;
  nodes: ReadonlyMap<string, DataNode>;
  /** The box of every shape, region, lane, and group, by id. */
  boxes: ReadonlyMap<string, Box>;
  warn: Warn;
}

const center = (b: Box): Vec2 => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** How far along `line` the point nearest `p` is, as a fraction of its length. */
function fractionNear(line: readonly Vec2[], p: Vec2): number {
  let total = 0;
  let best = { distance: Infinity, along: 0 };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (length * length)));
    const distance = Math.hypot(a.x + t * (b.x - a.x) - p.x, a.y + t * (b.y - a.y) - p.y);
    if (distance < best.distance) best = { distance, along: total + t * length };
    total += length;
  }
  return total === 0 ? 0.5 : best.along / total;
}

/** A label placement as the format's `x` from -1 to 1 along the edge and `y` off it. */
function labelGeometry(placement: DiagramLabel | undefined, line: readonly Vec2[]): { x: number; y: number } | undefined {
  if (placement === undefined) return undefined;
  const { at } = placement;
  const fraction = at === 'start' ? 0 : at === 'mid' ? 0.5 : at === 'end' ? 1 : typeof at === 'number' ? at : fractionNear(line, at.near);
  return { x: fraction * 2 - 1, y: placement.offset ?? 0 };
}

function portParts(page: EdgePage, end: string, port: string | undefined, side: 'exit' | 'entry'): StylePart[] {
  if (port === undefined) return [];
  const anchor = (page.nodes.get(end)?.ports ?? DEFAULT_PORTS).find((p) => p.id === port)?.at;
  if (anchor === undefined) {
    page.warn('Connectors ending on a port in a row were written meeting the shape wherever it is nearest.');
    return [];
  }
  return [[`${side}X`, anchor.u], [`${side}Y`, anchor.v], [`${side}Dx`, 0], [`${side}Dy`, 0]];
}

/** An edge cell on the page's layer, or `null`, with a warning, when an end is not on the page. */
export function writeEdge(edge: DataEdge, page: EdgePage): string | null {
  const from = page.boxes.get(edge.from);
  const to = page.boxes.get(edge.to);
  if (from === undefined || to === undefined) {
    page.warn('Connectors whose ends are not on their page were left out.');
    return null;
  }
  const points = edge.waypoints ?? edge.routed ?? [];
  const style = writeStyle([
    ...edgeStyle(edge, page.theme, page.warn),
    ...portParts(page, edge.from, edge.fromPort ?? edge.routedPorts?.from, 'exit'),
    ...portParts(page, edge.to, edge.toPort ?? edge.routedPorts?.to, 'entry'),
  ]);
  const label = labelGeometry(edge.labelPlacement, [center(from), ...points, center(to)]);
  const id = edge.id ?? edgeIdOf(edge);
  const ends = (['from', 'to'] as const).filter((end) => edge.endLabels?.[end])
    .map((end) => endLabelXml({ id: endLabelIdOf(id, end), value: edge.endLabels![end]!, parent: id }, end === 'from' ? -1 : 1));
  return edgeXml({ id, value: edge.label ?? '', style, parent: page.layer, source: edge.from, target: edge.to }, label, points)
    + ends.join('');
}
