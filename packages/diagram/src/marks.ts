/**
 * Marks: what a data node draws besides its rows. A drawn mark is SVG path
 * data in a unit square, stretched over the node's box, so it follows the node
 * wherever layout or a drag puts it. A text mark is pinned to a point on the box.
 */
import {
  commandFill,
  commandStroke,
  pathFromD,
  RECT_POSE_DESCRIPTOR,
  registerNodeShape,
  resolveFill,
  resolveStroke,
  transformPath,
  type Fill,
  type NodeShapeEntry,
  type Path,
  type PoseDescriptor,
  type Stroke,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { MeasureRowText, RowTextStyle } from './body';
import type { DiagramSpec, DiagramTextStyle, NodeStyle } from './fromData';
import { ANCHOR_DERIVE_POSE } from './group';
import type { Bounds } from './outline';
import { DIAGRAM_TRAIT_KEY } from './trait';
import type { PortAnchor } from './types';

/** One mark on a `DataNode`. Colors default to the node's stroke and text. */
export type DataMark =
  | { d: string; fill?: string; stroke?: string; strokeWidth?: number; dash?: number[]; opacity?: number }
  | { text: string; at: PortAnchor; self?: PortAnchor; offset?: Vec2; color?: string; style?: RowTextStyle };

/** The trait on a drawn mark's `data`: path data in a unit square. */
export interface DiagramMark { d: string }

/** The mark a scene node carries, or null for a node that is not a drawn
 *  mark: how `markShape` tells which nodes it paints. */
export function diagramMarkOf(node: { data: unknown }): DiagramMark | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as Record<string, unknown>)[DIAGRAM_TRAIT_KEY];
  if (trait === null || typeof trait !== 'object' || !('mark' in trait)) return null;
  const mark = (trait as { mark: unknown }).mark;
  return mark !== null && typeof mark === 'object' && typeof (mark as DiagramMark).d === 'string'
    ? (mark as DiagramMark)
    : null;
}

const PARSED = new Map<string, Path>();
const PARSED_MAX = 256;

function unitPath(d: string, onWarn?: (message: string) => void): Path {
  let path = PARSED.get(d);
  if (path === undefined) {
    let warned = false;
    path = pathFromD(d, (message) => {
      warned = true;
      onWarn?.(message);
    });
    if (path.kind === 'polygon' && path.commands.length === 0) onWarn?.('it draws nothing');
    else if (!warned) {
      if (PARSED.size >= PARSED_MAX) PARSED.clear();
      PARSED.set(d, path);
    }
  }
  return path;
}

/** Parse a drawn mark's path data now, so a typo surfaces where the diagram
 *  is built rather than at first paint. */
function checkMarkPath(nodeId: string, index: number, d: string): void {
  unitPath(d, (message) => {
    throw new Error(`diagramScene: node "${nodeId}", mark ${index}: path data ${JSON.stringify(d)} does not parse: ${message}`);
  });
}

/** The painter for a drawn mark. */
export function markShape<TPose>(
  opts: { geometry?: PoseDescriptor<TPose> } = {},
): NodeShapeEntry<unknown, TPose> {
  const geometry = opts.geometry ?? (RECT_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  return {
    id: 'diagram:mark',
    matches: (node) => diagramMarkOf(node) !== null,
    paint: (node, pose) => {
      const mark = diagramMarkOf(node);
      if (mark === null) return [];
      const box = geometry.getBounds(pose);
      const d = node.data as { fill?: Fill | null; stroke?: Stroke | null };
      const declaredFill = resolveFill(d.fill);
      const declaredStroke = resolveStroke(d.stroke);
      const fill = declaredFill && commandFill(declaredFill, box);
      const stroke = declaredStroke && commandStroke(declaredStroke, box);
      return [{
        kind: 'path',
        path: transformPath(unitPath(mark.d), [box.width, 0, 0, box.height, box.x, box.y]),
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      }];
    },
  };
}

/** Register {@link markShape}; returns the disposer. */
export function registerMarkShape<TPose>(opts: { geometry?: PoseDescriptor<TPose> } = {}): () => void {
  return registerNodeShape(markShape(opts), { priority: 'high' });
}

/** The specs for one node's marks. `box` is where the node stands. */
export function markSpecs(
  nodeId: string,
  marks: readonly DataMark[],
  box: Bounds,
  ctx: { style: NodeStyle; textStyle: (s: RowTextStyle | undefined) => DiagramTextStyle; measure: MeasureRowText },
): DiagramSpec[] {
  return marks.map((mark, i): DiagramSpec => {
    const id = `${nodeId}/mark:${i}` as never;
    if ('d' in mark) {
      checkMarkPath(nodeId, i, mark.d);
      const paint = (color: string) => ({ color, ...(mark.opacity !== undefined ? { opacity: mark.opacity } : {}) });
      const stroke = mark.stroke ?? (mark.fill === undefined ? ctx.style.stroke : undefined);
      return {
        id,
        kind: 'leaf',
        layer: 'main',
        parent: nodeId as never,
        pickable: false,
        pose: { x: box.x, y: box.y, width: box.width, height: box.height },
        data: {
          diagram: { mark: { d: mark.d } },
          ...(mark.fill !== undefined ? { fill: { paint: paint(mark.fill) } } : {}),
          ...(stroke !== undefined
            ? { stroke: { paint: paint(stroke), width: mark.strokeWidth ?? 1.5, ...(mark.dash ? { dash: mark.dash } : {}) } }
            : {}),
        },
      };
    }
    const size = ctx.measure(mark.text, mark.style ?? {});
    const self = mark.self ?? mark.at;
    return {
      id,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: {
        x: box.x + mark.at.u * box.width + (mark.offset?.x ?? 0) - self.u * size.width,
        y: box.y + mark.at.v * box.height + (mark.offset?.y ?? 0) - self.v * size.height,
        width: size.width,
        height: size.height,
      },
      data: {
        diagram: { anchor: { at: mark.at, self, ...(mark.offset ? { offset: mark.offset } : {}) } },
        text: mark.text,
        style: ctx.textStyle(mark.style),
        fill: { paint: { color: mark.color ?? ctx.style.text } },
      },
      dependsOn: [nodeId as never],
      derivePose: ANCHOR_DERIVE_POSE as never,
    };
  });
}
