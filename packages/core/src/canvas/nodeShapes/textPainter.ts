import {
  PATH_L,
  PATH_M,
  PATH_Z,
  type PolygonPath
} from '@weasel-js/geom';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import type { StyledRun, TextPose, TextStyle, TextVerticalAlign } from '@weasel-js/text';
import { textLineBoxes } from '@weasel-js/text';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import { textCommandFromPose } from '@weasel-js/renderer';
import { PAINT_SLOT } from './memo';
import { inkReach, resolveNodeStroke } from './nodePaint';
import { paintsPose } from './poseBox';

// ─── Built-in painters ─────────────────────────────────────────────────

/** The `data` a `kit:text` node carries. */
export interface TextNodeData {
  text: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: FillStyle | null;
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
  matches: (node) => {
    if (!paintsPose(node.pose)) return false;
    const d = node.data as { text?: string } | null;
    return d?.text != null;
  },
  // Memoized, and not for its own sake — `resolveTextStyle` + `resolveRuns`
  // are cheap (0.14 ms/frame at 1000 text nodes). It is the enabler: the
  // renderer's layout cache keys on the `ResolvedRun[]` array identity, and
  // `layoutRuns` costs 25.9 ms/frame for 200 wrapped paragraphs. Handing back
  // a fresh runs array per frame would leave that cache missing on every
  // draw, exactly as a fresh `Path` per frame defeated the mesh cache. Both
  // resolvers are pure style merging — no font reads — so `(data, pose)` is
  // the whole key. See PAINT_SLOT.
  //
  // `y` is the top of the first line box, not a baseline — see
  // `TextDrawCommand.y`. Wrap, alignment and run resolution are
  // `textCommandFromPose`'s, which `createTextLayer`, picking, the caret and
  // the edit overlay all share.
  paint: (node, pose) => nodeMemo(node, PAINT_SLOT, pose, () => [
    textCommandFromPose(textPoseOf(node.data as TextNodeData, pose)),
  ]),
  // The pose is a layout box, not a bounding box — "Away" in a 300-unit box
  // leaves most of it empty, and a pose-rect silhouette claims all of it. The
  // union of the line boxes is what the node actually covers, so picking,
  // lasso and clipping stop grabbing blank space.
  //
  // `null` rather than an empty path when there are no non-blank lines: an
  // empty text node would otherwise become unpickable, and a caller reading
  // "no silhouette" falls back to the pose rect, which is the behavior an
  // empty box wants.
  silhouette: (node, pose) => {
    const boxes = textLineBoxes(textPoseOf(node.data as TextNodeData, pose));
    if (boxes.length === 0) return null;
    return rectsToPath(boxes);
  },
  // `filled` is unconditional, `data.fill: null` included: the silhouette
  // above is line boxes, not glyph ink, so reporting outline-only text as
  // unfilled would leave it grabbable within a stroke width of a box edge and
  // nowhere near the letters. The reach still matters — a heavily outlined
  // glyph was unpickable across the width of its own outline.
  ink: (node, _pose, ctx) => {
    const d = node.data as { stroke?: Stroke | null };
    return { filled: true, ...inkReach(resolveNodeStroke(d.stroke), ctx?.scale) };
  },
};

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
