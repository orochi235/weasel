import {
  PATH_L,
  PATH_M,
  PATH_Z,
  type PolygonPath
} from '@weasel-js/geom';
import type { Stroke, Fill } from '@weasel-js/paint';
import type { StyledRun, TextPose, TextStyle, TextVerticalAlign } from '@weasel-js/text';
import { textLineBoxes } from '@weasel-js/text';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import { commandFill, textCommandFromPose, type DrawCommand } from '@weasel-js/renderer';
import { PAINT_SLOT } from './memo';
import { inkReach, resolveNodeFill, resolveNodeStroke } from './nodePaint';
import { paintsPose } from './poseBox';

/** The `data` a `kit:text` node carries. */
export interface TextNodeData {
  text: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: Fill | null;
  stroke?: Stroke | null;
  verticalAlign?: TextVerticalAlign;
  /** Paint for the whole pose box, drawn under the glyphs. `fill` is the
   *  glyphs' own paint, so a box behind them needs a key of its own. */
  background?: Fill | null;
  /** World units between the pose box and the box the text lays out in, on
   *  every side. */
  padding?: number;
}

/** The box a text node's lines lay out in: its pose box, inset by
 *  `data.padding` and never past its center. */
export function textBoxOf(
  d: Pick<TextNodeData, 'padding'>,
  p: RectPose,
): { x: number; y: number; width: number; height: number } {
  const pad = Math.max(0, d.padding ?? 0);
  const px = Math.min(pad, p.width / 2);
  const py = Math.min(pad, p.height / 2);
  return { x: p.x + px, y: p.y + py, width: p.width - 2 * px, height: p.height - 2 * py };
}

/** A `kit:text` node as the `TextPose` every text consumer reads, in the box
 *  {@link textBoxOf} insets. The stroke goes through the same resolver every
 *  other node kind's does, so one carrying no paint is dropped here rather
 *  than throwing in the renderer. */
export function textPoseOf(d: TextNodeData, p: RectPose): TextPose {
  return {
    ...textBoxOf(d, p),
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
  paint: (node, pose) => nodeMemo(node, PAINT_SLOT, pose, (): DrawCommand[] => {
    const d = node.data as TextNodeData;
    const text = textCommandFromPose(textPoseOf(d, pose));
    const bg = resolveNodeFill(d.background, null);
    if (!bg) return [text];
    const fill = commandFill(bg, pose);
    return [
      { kind: 'path', path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height }, ...(fill ? { fill } : {}) },
      text,
    ];
  }),
  // The pose is a layout box, not a bounding box: the union of the line boxes is what
  // the node actually covers, so picking, lasso, and clipping stop grabbing blank space.
  //
  // `null` rather than an empty path when there are no non-blank lines: a caller
  // reading "no silhouette" falls back to the pose rect, which keeps an empty text
  // node pickable.
  //
  // A background is ink across the whole box, so a node with one is its box.
  silhouette: (node, pose) => {
    if (resolveNodeFill((node.data as TextNodeData).background, null)) {
      return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
    }
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
