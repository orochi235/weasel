import type { GlMat3, Rect } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { CULL_SLACK_PX } from '../cullDrawCommands';
import { clipped, listBox, pathBox, type ScreenBox } from '../paintedBounds';
import type { RetainedClip } from './retainedKey';

/** A rect of the drawing buffer in whole device pixels, from its top left. */
export interface DeviceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A box of device pixels by its edges, from the drawing buffer's top left.
 *  An edge is infinite where nothing bounds the content that way. */
export interface DeviceBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The device pixels a retained group's `children` can paint, drawn under
 * `transform` inside `clips`, in a buffer that is `scale` device pixels to
 * the CSS pixel: snapped out to whole pixels, and unbounded where nothing
 * bounds them. A group with `effects` is grown by how far they reach
 * (`effectsReach`), and text by its layout and the ink margins `textBox`
 * allows it. A custom shader, and effects that do not say how far they reach,
 * are bounded only by the clips around them.
 */
export function contentBox(
  children: readonly DrawCommand[], transform: GlMat3, clips: readonly RetainedClip[], scale: number,
): DeviceBox {
  let box = listBox(children, transform, scale);
  for (const clip of clips) box = clipped(box, pathBox(clip.path, undefined, clip.transform));
  return snapOut(box, scale);
}

/** `box`, CSS pixels, in whole device pixels with the cull slack around it. */
function snapOut(box: ScreenBox, scale: number): DeviceBox {
  const x0 = Math.floor((box.minX - CULL_SLACK_PX) * scale);
  const y0 = Math.floor((box.minY - CULL_SLACK_PX) * scale);
  const x1 = Math.ceil((box.maxX + CULL_SLACK_PX) * scale);
  const y1 = Math.ceil((box.maxY + CULL_SLACK_PX) * scale);
  if ([x0, y0, x1, y1].some(Number.isNaN)) return { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
  return { x0, y0, x1, y1 };
}

/** The part of `box` inside `window`; empty, at the origin, where they do
 *  not meet. */
export function boxWithin(box: DeviceBox, window: DeviceRect): DeviceRect {
  const x0 = Math.max(window.x, box.x0);
  const y0 = Math.max(window.y, box.y0);
  const x1 = Math.min(window.x + window.width, box.x1);
  const y1 = Math.min(window.y + window.height, box.y1);
  if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * {@link contentBox} within a buffer `width × height` device pixels: what a
 * retained surface for `children` covers. Empty where nothing lands inside it.
 */
export function contentBounds(
  children: readonly DrawCommand[], transform: GlMat3, clips: readonly RetainedClip[],
  scale: number, width: number, height: number,
): DeviceRect {
  return boxWithin(contentBox(children, transform, clips, scale), { x: 0, y: 0, width, height });
}

/**
 * The rect `commands` can paint under `transform`, in whole units of the space
 * `transform` maps into, within a `width × height` page from that space's
 * origin; zero-sized where nothing lands on it. `scale` is the device pixels
 * per unit they will be drawn at, which is what an effect's reach is measured
 * in.
 */
export function commandsBounds(
  commands: readonly DrawCommand[], transform: GlMat3, page: { width: number; height: number }, scale = 1,
): Rect {
  return boxWithin(snapOut(listBox(commands, transform, scale), 1), { x: 0, y: 0, width: page.width, height: page.height });
}
