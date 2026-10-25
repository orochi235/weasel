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

/**
 * The device pixels a retained group's `children` can paint, drawn under
 * `transform` inside `clips`, within a buffer `width × height` device pixels
 * that is `scale` device pixels to the CSS pixel. A group with `effects` is
 * grown by how far they reach (`effectsReach`). Text, a custom shader, and
 * effects that do not say how far they reach are bounded only by the clips
 * around them; with none, the bound is the whole buffer. Empty where nothing
 * lands inside it.
 */
export function contentBounds(
  children: readonly DrawCommand[], transform: GlMat3, clips: readonly RetainedClip[],
  scale: number, width: number, height: number,
): DeviceRect {
  let box = listBox(children, transform, scale);
  for (const clip of clips) box = clipped(box, pathBox(clip.path, undefined, clip.transform));
  return toDevice(box, scale, width, height);
}

function toDevice(box: ScreenBox, scale: number, width: number, height: number): DeviceRect {
  const x0 = Math.max(0, Math.floor((box.minX - CULL_SLACK_PX) * scale));
  const y0 = Math.max(0, Math.floor((box.minY - CULL_SLACK_PX) * scale));
  const x1 = Math.min(width, Math.ceil((box.maxX + CULL_SLACK_PX) * scale));
  const y1 = Math.min(height, Math.ceil((box.maxY + CULL_SLACK_PX) * scale));
  if ([x0, y0, x1, y1].some(Number.isNaN)) return { x: 0, y: 0, width, height };
  if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
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
  return toDevice(listBox(commands, transform, scale), 1, page.width, page.height);
}
