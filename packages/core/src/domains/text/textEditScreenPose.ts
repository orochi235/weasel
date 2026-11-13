import { poseFrameOf } from '@weasel-js/geom';
import { resolveScreenLength } from '@weasel-js/paint';
import { DEFAULT_TEXT_STYLE, textFitScale, type StyledRun } from '@weasel-js/text';
import type { TextEditClipRect, TextEditScreenPose } from '@weasel-js/text-dom';
import type { RectPose } from 'core/geometry/unionBounds';
import type { View } from '../../core/viewport/view';
import { textBoxOf, type TextOverflow } from '../../canvas/nodeShapes/textPainter';
import type { TextReads } from './textHitAt';

/** What the overlay's pose reads of a node's `data`. */
export type ScreenPoseReads<TData> = TextReads<TData> & { overflow(data: TData): TextOverflow | undefined };

/** The overlay's pose for a node painted at `painted`: its text box, inset
 *  about the box center, which is all the overlay's frame needs, projected
 *  through `view`. Text the node's `fit` shrinks is edited at its own size
 *  under a zoom smaller by the fit, in a box larger by it, so it shows at the
 *  size the canvas draws it and writes its own sizes back. */
export function screenPoseOf<TData>(
  d: TData,
  painted: RectPose,
  read: ScreenPoseReads<TData>,
  view: View | undefined,
  origin: TextEditClipRect | undefined,
): TextEditScreenPose {
  const inset = textBoxOf({ padding: read.padding(d) }, painted);
  const box = screenBoxOf({ ...painted, ...inset }, view, origin);
  const style = read.style(d);
  // `kit:text` lays the text out at scale 1, a `{ px }` size as that many world units.
  const k = textFitScale({
    ...inset, text: read.text(d), runs: read.runs(d) as StyledRun[] | undefined, style,
    verticalAlign: read.verticalAlign(d), fit: read.fit?.(d),
  });
  const clip = read.overflow(d) === 'clip' ? clipToBox(inset, painted) : null;
  return {
    ...box,
    width: box.width / k,
    height: box.height / k,
    zoom: box.zoom * k,
    fontSize: resolveScreenLength(style?.fontSize ?? DEFAULT_TEXT_STYLE.fontSize, 1),
    pxScale: 1,
    verticalAlign: read.verticalAlign(d),
    ...(clip ? { clip: { top: clip.top / k, left: clip.left / k, bottom: clip.bottom / k, right: clip.right / k } } : {}),
  };
}

/** How far `box` reaches past `inner` on each side: the overlay's cut at
 *  `box` when its own pose is `inner`. */
function clipToBox(inner: RectPose, box: RectPose): NonNullable<TextEditScreenPose['clip']> {
  return {
    top: inner.y - box.y,
    left: inner.x - box.x,
    bottom: box.y + box.height - (inner.y + inner.height),
    right: box.x + box.width - (inner.x + inner.width),
  };
}

/**
 * `pose`'s box as the overlay takes it, `origin` being the canvas's corner in
 * container pixels. Only the box center is projected, since the overlay's
 * frame is about it. Width and height stay in world units and reach the
 * screen through the overlay's own `scale(zoom)` — see
 * `TextEditScreenPose.zoom`.
 */
function screenBoxOf(
  pose: RectPose,
  view: View | undefined,
  origin: { x: number; y: number } | undefined,
): Pick<TextEditScreenPose, 'x' | 'y' | 'width' | 'height' | 'frame'> & { zoom: number } {
  const zoom = view ? view.scale.x : 1;
  const zoomY = view ? view.scale.y : 1;
  const cx = (origin?.x ?? 0) + (pose.x + pose.width / 2 - (view?.x ?? 0)) * zoom;
  const cy = (origin?.y ?? 0) + (pose.y + pose.height / 2 - (view?.y ?? 0)) * zoomY;
  return {
    x: cx - (pose.width * zoom) / 2,
    y: cy - (pose.height * zoom) / 2,
    width: pose.width,
    height: pose.height,
    zoom,
    frame: frameLinearOf(pose, zoomY / zoom),
  };
}

/** The linear part of the frame `pose` is drawn in, as the overlay takes it.
 *  `stretch` is the view's y scale over its x scale: the overlay scales both
 *  axes by the x scale, so the frame carries what is left of y. */
function frameLinearOf(pose: unknown, stretch: number): TextEditScreenPose['frame'] {
  const m = poseFrameOf(pose);
  if (!m && stretch === 1) return undefined;
  const [a, b, c, d] = m ?? [1, 0, 0, 1];
  return [a, b * stretch, c, d * stretch];
}
