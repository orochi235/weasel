import {
  PATH_L,
  PATH_M,
  PATH_Z,
  type PolygonPath,
  type Rect,
  unionRects,
} from '@weasel-js/geom';
import type { Stroke, Fill, Inherit } from '@weasel-js/paint';
import type { StyledRun, TextFit, TextPose, TextStyle, TextVerticalAlign } from '@weasel-js/text';
import { textEngineGeneration, textLineBoxes, type TextOutlineSource } from '@weasel-js/text';
import { faceGeneration } from '@weasel-js/font';
import type { PathInWorldPose } from '@weasel-js/geom';
import { textEffectItems } from './textItems';
import { textOutlineOf } from './textOutline';
import { commandFill, textCommandFromPose, type DrawCommand } from '@weasel-js/renderer';
import { INHERIT, resolveFill, resolveStroke } from '@weasel-js/paint';
import { textFrameOf, textShadowBox, type TextEdge, type TextShadow } from './textFrame';
import { inkReach, nodeMemo, PAINT_SLOT, paintsPose, strokeOutsetPerAxis, type InheritedPaint, type NodeShapeEntry, type RectPose } from '@weasel-js/core';

/** The `data` a `kit:text` node carries. */
export interface TextNodeData {
  text: string;
  style?: TextStyle;
  runs?: readonly StyledRun[];
  fill?: Fill | Inherit | null;
  stroke?: Stroke | Inherit | null;
  verticalAlign?: TextVerticalAlign;
  /** Paint for the whole pose box, drawn under the glyphs. `fill` is the
   *  glyphs' own paint, so a box behind them needs a key of its own. */
  background?: Fill | null;
  /** World units between the pose box and the box the text lays out in, on
   *  every side. */
  padding?: number;
  /** What happens to text that runs past the pose box: `'visible'` (the
   *  default) draws it there, `'clip'` cuts it at the box's edge. */
  overflow?: TextOverflow;
  /** `'shrink'` sets the text at the largest size, at most its own, whose
   *  lines fit the box inside `padding`. Default `'none'`. */
  fit?: TextFit;
  /** A rule just inside the box in a shade of `background`. Needs a solid background. */
  edge?: TextEdge;
  /** The shadow `background` casts. Needs a background. */
  shadow?: TextShadow;
}

/** How a text node treats lines that run past its box. */
export type TextOverflow = 'visible' | 'clip';


/** `cmd` cut to `box`: a group whose clip is the box as a rect, which the
 *  renderer cuts on the CPU when the frame keeps it axis-aligned. */
export function clippedToBox(cmd: DrawCommand, box: Rect): DrawCommand {
  return {
    kind: 'group',
    clip: { kind: 'rect', x: box.x, y: box.y, width: box.width, height: box.height },
    children: [cmd],
  };
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
export function textPoseOf(d: TextNodeData, p: RectPose, inherited?: InheritedPaint): TextPose {
  return {
    ...textBoxOf(d, p),
    text: d.text,
    runs: d.runs as StyledRun[] | undefined,
    style: d.style,
    fill: d.fill === INHERIT ? resolveFill(d.fill, inherited?.fill) : d.fill,
    stroke: resolveStroke(d.stroke, inherited?.stroke) ?? undefined,
    verticalAlign: d.verticalAlign,
    fit: d.fit,
  };
}

/** The node shape that paints a text node: one whose data carries a `text` string, drawn at its box pose. */
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
  // the whole key, with the view scale beside it for `{ px }` text. See PAINT_SLOT.
  paint: (node, pose, ctx) => {
    const d = node.data as TextNodeData;
    const inherited = ctx?.inherited;
    const scale = textLayoutScale(d, ctx?.scale);
    if (scale === 1) return nodeMemo(node, PAINT_SLOT, pose, () => paintText(d, pose, inherited, 1), inherited);
    const held = nodeMemo(node, SCREEN_PAINT_SLOT, pose,
      (): ScreenPaint => ({ scale, inherited, cmds: paintText(d, pose, inherited, scale) }));
    if (held.scale !== scale || held.inherited !== inherited) {
      held.scale = scale;
      held.inherited = inherited;
      held.cmds = paintText(d, pose, inherited, scale);
    }
    return held.cmds;
  },
  // The pose is a layout box, not a bounding box: the union of the line boxes is what
  // the node actually covers, so picking, lasso, and clipping stop grabbing blank space.
  //
  // `null` rather than an empty path when there are no non-blank lines: a caller
  // reading "no silhouette" falls back to the pose rect, which keeps an empty text
  // node pickable.
  //
  // A background is ink across the whole box, so a node with one is its box.
  // A clipped node's lines are cut to the box, as they are drawn.
  silhouette: (node, pose, ctx) => {
    const d = node.data as TextNodeData;
    if (resolveFill(d.background)) {
      return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
    }
    const lines = textLineBoxes(textPoseOf(d, pose), { scale: textLayoutScale(d, ctx?.scale) });
    const boxes = d.overflow === 'clip' ? cutRects(lines, pose) : lines;
    if (boxes.length === 0) return null;
    return rectsToPath(boxes);
  },
  // `filled` is unconditional, `data.fill: null` included: the silhouette above is line
  // boxes, not glyph ink, so reporting outline-only text as unfilled would leave it
  // grabbable within a stroke width of a box edge and nowhere near the letters.
  ink: (node, _pose, ctx) => {
    const d = node.data as TextNodeData;
    return { filled: true, ...inkReach(resolveStroke(d.stroke, ctx?.inherited?.stroke), ctx?.scale) };
  },
  drawnBounds: (node, pose, ctx) => {
    const d = node.data as TextNodeData;
    const stroke = resolveStroke(d.stroke, ctx?.inherited?.stroke);
    const lines = stroke
      ? strokedLinesBox(pose, textLineBoxes(textPoseOf(d, pose, ctx?.inherited), { scale: textLayoutScale(d, ctx?.scale) }), strokeOutsetPerAxis(stroke, ctx))
      : null;
    const shadow = textShadowBox(d, pose);
    return shadow ? unionRects([lines ?? pose, shadow]) : lines;
  },
  outline: (node, pose, ctx) => {
    const d = node.data as TextNodeData;
    return textOutlineOf(d, { ...pose, ...textBoxOf(d, pose) }, ctx?.inherited);
  },
  // Line boxes and glyphs follow the faces and the registered layout engines.
  geometryGeneration: () => faceGeneration() + textEngineGeneration(),
  silhouetteKey: (node, ctx) => textLayoutScale(node.data as TextNodeData, ctx?.scale),
  effectItems: (node, pose) => textEffectItems(node.data as TextOutlineSource, pose as PathInWorldPose),
};

/** The view scale `d` lays out at: `scale` when its style or a run sizes
 *  something in `{ px }`, else 1, so world-sized text keeps its memo through a zoom. */
export function textLayoutScale(d: Pick<TextNodeData, 'style' | 'runs'>, scale: number | undefined): number {
  if (scale === undefined || scale === 1) return 1;
  const sized = (s: Pick<TextStyle, 'fontSize' | 'letterSpacing'> | undefined): boolean =>
    typeof s?.fontSize === 'object' || typeof s?.letterSpacing === 'object';
  return sized(d.style) || (d.runs?.some(sized) ?? false) ? scale : 1;
}

/** A `{ px }` text node's commands and the scale and inherited paint they were laid out under. */
interface ScreenPaint { scale: number; inherited: InheritedPaint | undefined; cmds: DrawCommand[] }

const SCREEN_PAINT_SLOT = 'shape:paint:text-screen';

/** `y` is the top of the first line box, not a baseline — see `TextDrawCommand.y`. */
function paintText(d: TextNodeData, pose: RectPose, inherited: InheritedPaint | undefined, scale: number): DrawCommand[] {
  const laid = textCommandFromPose(textPoseOf(d, pose, inherited), scale);
  const text = d.overflow === 'clip' ? clippedToBox(laid, pose) : laid;
  const bg = resolveFill(d.background);
  if (!bg) return [text];
  const fill = commandFill(bg, pose);
  const { shadow, edge } = textFrameOf(d, pose);
  const out: DrawCommand[] = [];
  if (shadow) {
    const paint = { paint: { kind: 'solid' as const, color: shadow.color } };
    out.push({ kind: 'group', alpha: shadow.opacity, children: shadow.paths.map((path) => ({ kind: 'path' as const, path, fill: paint })) });
  }
  out.push({ kind: 'path', path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height }, ...(fill ? { fill } : {}) });
  if (edge) out.push({ kind: 'path', path: edge.path, stroke: { paint: { kind: 'solid', color: edge.color }, width: edge.width } });
  out.push(text);
  return out;
}

/** Each of `rects` cut to `box`, leaving out any it does not overlap. */
function cutRects(rects: readonly Rect[], box: Rect): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    const x0 = Math.max(r.x, box.x);
    const y0 = Math.max(r.y, box.y);
    const x1 = Math.min(r.x + r.width, box.x + box.width);
    const y1 = Math.min(r.y + r.height, box.y + box.height);
    if (x1 > x0 && y1 > y0) out.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return out;
}

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
