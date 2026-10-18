import {
  PATH_L,
  PATH_M,
  PATH_Z,
  type PolygonPath,
  type Rect,
} from '@weasel-js/geom';
import type { Stroke, Fill } from '@weasel-js/paint';
import type { StyledRun, TextPose, TextStyle, TextVerticalAlign } from '@weasel-js/text';
import { textLineBoxes } from '@weasel-js/text';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import { textCommandFromPose } from '@weasel-js/renderer';
import { PAINT_SLOT } from './memo';
import { inkReach, resolveNodeStroke, strokeOutsetPerAxis } from './nodePaint';
import { paintsPose } from './poseBox';

/** The `data` a `kit:text` node carries. */
export interface TextNodeData {
  text: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: Fill | null;
  stroke?: Stroke | null;
  verticalAlign?: TextVerticalAlign;
}

/** A `kit:text` node as the `TextPose` every text consumer reads. The stroke
 *  goes through the same resolver every other node kind's does, so one
 *  carrying no paint is dropped here rather than throwing in the renderer. */
export function textPoseOf(d: TextNodeData, p: RectPose): TextPose {
  return {
    x: p.x, y: p.y, width: p.width, height: p.height,
    text: d.text,
    runs: d.runs as StyledRun[] | undefined,
    style: d.style,
    fill: d.fill,
    stroke: resolveNodeStroke(d.stroke) ?? undefined,
    verticalAlign: d.verticalAlign,
  };
}

export const TEXT_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  id: 'kit:text',
  snapsToBox: true,
  matches: (node) => {
    if (!paintsPose(node.pose)) return false;
    const d = node.data as { text?: string } | null;
    return d?.text != null;
  },
  // Memoized because the renderer's layout cache keys on the `ResolvedRun[]` array
  // identity: a fresh runs array per frame would leave that cache missing on every
  // draw. Both resolvers are pure style merging — no font reads — so `(data, pose)` is
  // the whole key. See PAINT_SLOT.
  //
  // `y` is the top of the first line box, not a baseline — see `TextDrawCommand.y`.
  paint: (node, pose) => nodeMemo(node, PAINT_SLOT, pose, () => [
    textCommandFromPose(textPoseOf(node.data as TextNodeData, pose)),
  ]),
  // The pose is a layout box, not a bounding box: the union of the line boxes is what
  // the node actually covers, so picking, lasso, and clipping stop grabbing blank space.
  //
  // `null` rather than an empty path when there are no non-blank lines: a caller
  // reading "no silhouette" falls back to the pose rect, which keeps an empty text
  // node pickable.
  silhouette: (node, pose) => {
    const boxes = textLineBoxes(textPoseOf(node.data as TextNodeData, pose));
    if (boxes.length === 0) return null;
    return rectsToPath(boxes);
  },
  // `filled` is unconditional, `data.fill: null` included: the silhouette above is line
  // boxes, not glyph ink, so reporting outline-only text as unfilled would leave it
  // grabbable within a stroke width of a box edge and nowhere near the letters.
  ink: (node, _pose, ctx) => {
    const d = node.data as { stroke?: Stroke | null };
    return { filled: true, ...inkReach(resolveNodeStroke(d.stroke), ctx?.scale) };
  },
  drawnBounds: (node, pose, ctx) => {
    const d = node.data as TextNodeData;
    const stroke = resolveNodeStroke(d.stroke);
    return stroke ? strokedLinesBox(pose, textLineBoxes(textPoseOf(d, pose)), strokeOutsetPerAxis(stroke, ctx)) : null;
  },
};

/**
 * The layout box grown where a stroked line reaches it: each line box, cut to
 * the layout box, then outset by the stroke's reach. A line that overflows the
 * layout box is left to it — the layout box is what a text node claims.
 */
function strokedLinesBox(pose: RectPose, lines: readonly Rect[], reach: { x: number; y: number }): Rect | null {
  if (!(reach.x > 0 || reach.y > 0)) return null;
  let x0 = pose.x, y0 = pose.y, x1 = pose.x + pose.width, y1 = pose.y + pose.height;
  for (const l of lines) {
    const lx0 = Math.max(l.x, pose.x), ly0 = Math.max(l.y, pose.y);
    const lx1 = Math.min(l.x + l.width, pose.x + pose.width), ly1 = Math.min(l.y + l.height, pose.y + pose.height);
    if (lx1 <= lx0 || ly1 <= ly0) continue;
    x0 = Math.min(x0, lx0 - reach.x); y0 = Math.min(y0, ly0 - reach.y);
    x1 = Math.max(x1, lx1 + reach.x); y1 = Math.max(y1, ly1 + reach.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Union of axis-aligned rects as one multi-contour `PolygonPath`.
 *
 * Every contour winds the same way, so `'nonzero'` reads overlapping rects as
 * covered rather than punching a hole where two lines happen to overlap —
 * which they do the moment `lineHeight` drops below 1.
 */
export function rectsToPath(rects: readonly { x: number; y: number; width: number; height: number }[]): PolygonPath {
  const commands = new Uint8Array(rects.length * 6);
  const coords = new Float32Array(rects.length * 10);
  let ci = 0;
  let cmd = 0;
  for (const r of rects) {
    const { x, y, width: w, height: h } = r;
    commands[cmd++] = PATH_M; coords[ci++] = x; coords[ci++] = y;
    commands[cmd++] = PATH_L; coords[ci++] = x + w; coords[ci++] = y;
    commands[cmd++] = PATH_L; coords[ci++] = x + w; coords[ci++] = y + h;
    commands[cmd++] = PATH_L; coords[ci++] = x; coords[ci++] = y + h;
    commands[cmd++] = PATH_L; coords[ci++] = x; coords[ci++] = y;
    commands[cmd++] = PATH_Z;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}
