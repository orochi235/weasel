import type { Path } from 'features/paths/types';
import type { Stroke } from '@weasel-js/paint';
import { SPRITE_STRIDE, type DrawCommand } from './DrawCommand';
import { mat3, type Mat3 } from './math/mat3';

/** A screen-space rectangle, CSS pixels. */
export interface CullRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Screen pixels added to every bound: antialiasing, and the 1/8 px a `{ px }`
 *  stroke's width may drift through quantization. */
const SLACK_PX = 1;

/** Matches the tessellator's default. */
const DEFAULT_MITER_LIMIT = 4;

/**
 * `cmds` without the commands that cannot put a pixel inside `rect`, where
 * `transform` maps the commands' space to screen space — `viewToMat3(view)`
 * for a world-space layer.
 *
 * Conservative by construction: a command is dropped only when a bound that
 * encloses everything it can paint misses `rect`. Paths are bounded by their
 * control hull plus the farthest a stroke can reach (miter spikes and square
 * caps included), images and sprites by their quads, and every bound is taken
 * through the accumulated transform as the AABB of its corners, so rotation
 * only enlarges it. Text and shader commands are always kept, and so is a
 * group with `effects` — an effect may move pixels. Clips are ignored, which
 * can only keep more. A group whose children all go is dropped.
 *
 * Returns `cmds` itself when nothing was dropped.
 */
export function cullDrawCommands(
  cmds: DrawCommand[],
  transform: Mat3,
  rect: CullRect,
): DrawCommand[] {
  const box = {
    minX: rect.x - SLACK_PX,
    minY: rect.y - SLACK_PX,
    maxX: rect.x + rect.width + SLACK_PX,
    maxY: rect.y + rect.height + SLACK_PX,
  };
  return cullList(cmds, transform, box);
}

interface Box { minX: number; minY: number; maxX: number; maxY: number }

function cullList(cmds: DrawCommand[], m: Mat3, box: Box): DrawCommand[] {
  let out: DrawCommand[] | null = null;
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    const kept = cullOne(cmd, m, box);
    if (kept === cmd) {
      out?.push(cmd);
      continue;
    }
    out ??= cmds.slice(0, i);
    if (kept) out.push(kept);
  }
  return out ?? cmds;
}

function cullOne(cmd: DrawCommand, m: Mat3, box: Box): DrawCommand | null {
  switch (cmd.kind) {
    case 'group': {
      if (cmd.effects && cmd.effects.length > 0) return cmd;
      const inner = cmd.transform ? mat3.multiply(m, cmd.transform) : m;
      const children = cullList(cmd.children, inner, box);
      if (children === cmd.children) return cmd;
      return children.length === 0 ? null : { ...cmd, children };
    }
    case 'path':
      return pathMisses(cmd.path, cmd.stroke, m, box) ? null : cmd;
    case 'image':
      return quadMisses(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h, m, box) ? null : cmd;
    case 'sprites':
      return spritesMiss(cmd.sprites, m, box) ? null : cmd;
    default:
      return cmd;
  }
}

function pathMisses(path: Path, stroke: Stroke | undefined, m: Mat3, box: Box): boolean {
  let minX: number, minY: number, maxX: number, maxY: number;
  if (path.kind === 'rect') {
    minX = Math.min(path.x, path.x + path.width);
    maxX = Math.max(path.x, path.x + path.width);
    minY = Math.min(path.y, path.y + path.height);
    maxY = Math.max(path.y, path.y + path.height);
  } else if (path.kind === 'polygon') {
    const c = path.coords;
    if (c.length < 2) return false;
    minX = maxX = c[0];
    minY = maxY = c[1];
    for (let i = 2; i + 1 < c.length; i += 2) {
      const x = c[i], y = c[i + 1];
      if (x < minX) minX = x; else if (x > maxX) maxX = x;
      if (y < minY) minY = y; else if (y > maxY) maxY = y;
    }
  } else {
    return false;
  }
  const reach = stroke ? strokeReach(stroke, m) : 0;
  return quadMisses(minX - reach, minY - reach, maxX + reach, maxY + reach, m, box);
}

/** How far outside the geometry a stroke can paint, in the path's own units.
 *  A full width rather than half covers `'outer'` alignment, which the
 *  renderer draws as a doubled ribbon; the miter limit covers every join. */
function strokeReach(stroke: Stroke, m: Mat3): number {
  const w = stroke.width ?? 1;
  let width = typeof w === 'number' ? w : w.px / (mat3.meanScaleOf(m) || 1);
  if (stroke.vertexWidths) {
    for (const v of stroke.vertexWidths) if (v > width) width = v;
  }
  const spike = Math.max(stroke.miterLimit ?? DEFAULT_MITER_LIMIT, Math.SQRT2);
  return Math.abs(width) * spike;
}

function spritesMiss(sprites: Float32Array, m: Mat3, box: Box): boolean {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + SPRITE_STRIDE <= sprites.length; i += SPRITE_STRIDE) {
    const x0 = sprites[i], y0 = sprites[i + 1];
    const x1 = x0 + sprites[i + 2], y1 = y0 + sprites[i + 3];
    minX = Math.min(minX, x0, x1); maxX = Math.max(maxX, x0, x1);
    minY = Math.min(minY, y0, y1); maxY = Math.max(maxY, y0, y1);
  }
  if (minX === Infinity) return false;
  return quadMisses(minX, minY, maxX, maxY, m, box);
}

/** True when the local rect, taken through `m`, lies wholly outside `box`.
 *  Any NaN makes every comparison false, so the command is kept. */
function quadMisses(x0: number, y0: number, x1: number, y1: number, m: Mat3, box: Box): boolean {
  const [ax, ay] = mat3.apply(m, x0, y0);
  const [bx, by] = mat3.apply(m, x1, y0);
  const [cx, cy] = mat3.apply(m, x1, y1);
  const [dx, dy] = mat3.apply(m, x0, y1);
  return (
    Math.max(ax, bx, cx, dx) < box.minX ||
    Math.min(ax, bx, cx, dx) > box.maxX ||
    Math.max(ay, by, cy, dy) < box.minY ||
    Math.min(ay, by, cy, dy) > box.maxY
  );
}
