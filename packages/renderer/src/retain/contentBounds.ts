import { mat3, type GlMat3, type Rect } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { effectsReach } from '../effects/types';
import { CULL_SLACK_PX, paintedBox, pathBox, type ScreenBox } from '../cullDrawCommands';
import type { RetainedClip } from './retainedKey';

/** A rect of the drawing buffer in whole device pixels, from its top left. */
export interface DeviceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMPTY: ScreenBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
const ANYWHERE: ScreenBox = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };

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

/** `scale` is device pixels to the unit of the space `m` maps into, which an effect's reach is measured in. */
function listBox(cmds: readonly DrawCommand[], m: GlMat3, scale: number): ScreenBox {
  let acc = EMPTY;
  for (const cmd of cmds) {
    acc = union(acc, commandBox(cmd, m, scale));
    if (acc === ANYWHERE) break;
  }
  return acc;
}

function commandBox(cmd: DrawCommand, m: GlMat3, scale: number): ScreenBox {
  switch (cmd.kind) {
    case 'group': {
      const inner = cmd.transform ? mat3.multiply(m, cmd.transform) : m;
      let box = listBox(cmd.children, inner, scale);
      if (cmd.effects && cmd.effects.length > 0) box = grown(box, effectsReach(cmd.effects) / scale);
      return cmd.clip ? clipped(box, pathBox(cmd.clip, undefined, inner)) : box;
    }
    case 'path':
    case 'image':
    case 'sprites':
      return paintedBox(cmd, m) ?? ANYWHERE;
    default:
      return ANYWHERE;
  }
}

function grown(box: ScreenBox, by: number): ScreenBox {
  if (box === EMPTY || box === ANYWHERE || by === 0) return box;
  if (!Number.isFinite(by)) return ANYWHERE;
  return { minX: box.minX - by, minY: box.minY - by, maxX: box.maxX + by, maxY: box.maxY + by };
}

function union(a: ScreenBox, b: ScreenBox): ScreenBox {
  if (a === EMPTY || b === ANYWHERE) return b;
  if (b === EMPTY || a === ANYWHERE) return a;
  return {
    minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
  };
}

function clipped(a: ScreenBox, clip: ScreenBox | null): ScreenBox {
  if (!clip || a === EMPTY) return a;
  const box = {
    minX: Math.max(a.minX, clip.minX), minY: Math.max(a.minY, clip.minY),
    maxX: Math.min(a.maxX, clip.maxX), maxY: Math.min(a.maxY, clip.maxY),
  };
  return box.minX > box.maxX || box.minY > box.maxY ? EMPTY : box;
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
