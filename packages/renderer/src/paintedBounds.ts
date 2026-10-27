import { type Path, mat3, type GlMat3 } from '@weasel-js/geom';
import { resolveScreenLength, type Stroke } from '@weasel-js/paint';
import { markerReach, resolveStrokeWidth, widestStrokeWidth } from '@weasel-js/stroke';
import {
  SPRITE_STRIDE, type DrawCommand, type ImageDrawCommand, type PathDrawCommand, type SpritesDrawCommand,
} from './DrawCommand';
import { effectsReach } from './effects/types';
import { textBox } from './textBounds';

/** Matches the tessellator's default. */
const DEFAULT_MITER_LIMIT = 4;

/** An axis-aligned box in screen space, CSS pixels. */
export interface ScreenBox { minX: number; minY: number; maxX: number; maxY: number }

const EMPTY: ScreenBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
const ANYWHERE: ScreenBox = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };

/** `scale` is device pixels to the unit of the space `m` maps into, which an effect's reach is measured in. */
export function listBox(cmds: readonly DrawCommand[], m: GlMat3, scale: number): ScreenBox {
  let acc = EMPTY;
  for (const cmd of cmds) {
    acc = union(acc, commandBox(cmd, m, scale));
    if (acc === ANYWHERE) break;
  }
  return acc;
}

export function commandBox(cmd: DrawCommand, m: GlMat3, scale: number): ScreenBox {
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
    case 'text':
      return textBox(cmd, m) ?? EMPTY;
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

export function clipped(a: ScreenBox, clip: ScreenBox | null): ScreenBox {
  if (!clip || a === EMPTY) return a;
  const box = {
    minX: Math.max(a.minX, clip.minX), minY: Math.max(a.minY, clip.minY),
    maxX: Math.min(a.maxX, clip.maxX), maxY: Math.min(a.maxY, clip.maxY),
  };
  return box.minX > box.maxX || box.minY > box.maxY ? EMPTY : box;
}

/**
 * A screen-space box enclosing every pixel a path, image or sprites command
 * can paint under `m`, slack left out: the bound culling tests.
 * `null` where there is nothing to bound by, which a caller must read as
 * anywhere.
 */
export function paintedBox(
  cmd: PathDrawCommand | ImageDrawCommand | SpritesDrawCommand, m: GlMat3,
): ScreenBox | null {
  switch (cmd.kind) {
    case 'path': return pathBox(cmd.path, cmd.stroke, m);
    case 'image': return screenBox(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y + cmd.h, m);
    case 'sprites': return spritesBox(cmd.sprites, m);
  }
}

/** The screen-space box of `path` under `m`, grown by how far `stroke` can
 *  reach past it. */
export function pathBox(path: Path, stroke: Stroke | undefined, m: GlMat3): ScreenBox | null {
  let minX: number, minY: number, maxX: number, maxY: number;
  if (path.kind === 'rect') {
    minX = Math.min(path.x, path.x + path.width);
    maxX = Math.max(path.x, path.x + path.width);
    minY = Math.min(path.y, path.y + path.height);
    maxY = Math.max(path.y, path.y + path.height);
  } else if (path.kind === 'polygon') {
    const c = path.coords;
    if (c.length < 2) return null;
    minX = maxX = c[0];
    minY = maxY = c[1];
    for (let i = 2; i + 1 < c.length; i += 2) {
      const x = c[i], y = c[i + 1];
      if (x < minX) minX = x; else if (x > maxX) maxX = x;
      if (y < minY) minY = y; else if (y > maxY) maxY = y;
    }
  } else {
    return null;
  }
  const reach = stroke ? strokeReach(stroke, m) : 0;
  return screenBox(minX - reach, minY - reach, maxX + reach, maxY + reach, m);
}

/** How far outside the geometry a stroke can paint, in the path's own units.
 *  A full width rather than half covers `'outer'` alignment, which the
 *  renderer draws as a doubled ribbon; the miter limit covers every join. A
 *  marker head sits on a vertex, so its reach is measured from the hull too. */
function strokeReach(stroke: Stroke, m: GlMat3): number {
  return strokeReachAt(stroke, mat3.meanScaleOf(m), mat3.minScaleOf(m));
}

/**
 * How far a stroke reaches past its geometry at a known world-to-screen scale — what a painter
 * bounding its own output before it paints can know. `least` is the scale
 * along the axis the transform shrinks most, where it differs from `scale`.
 *
 * A `{ px }` ribbon or head is built to its screen size in every direction,
 * so in world it reaches farthest along that axis. A head with a world size is
 * built in world, whatever the line's width is in.
 */
export function strokeReachAt(stroke: Stroke, scale: number, least = scale): number {
  const at = least > 0 ? least : scale;
  const base = resolveStrokeWidth(stroke.width ?? 1, typeof stroke.width === 'object' ? at : scale);
  const width = widestStrokeWidth(base, stroke.vertexWidths);
  const spike = Math.max(stroke.miterLimit ?? DEFAULT_MITER_LIMIT, Math.SQRT2);
  const heads = markerReach(stroke);
  return Math.max(Math.abs(width) * spike, heads.world, resolveScreenLength({ px: heads.px }, at));
}

function spritesBox(sprites: Float32Array, m: GlMat3): ScreenBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + SPRITE_STRIDE <= sprites.length; i += SPRITE_STRIDE) {
    const x0 = sprites[i], y0 = sprites[i + 1];
    const x1 = x0 + sprites[i + 2], y1 = y0 + sprites[i + 3];
    minX = Math.min(minX, x0, x1); maxX = Math.max(maxX, x0, x1);
    minY = Math.min(minY, y0, y1); maxY = Math.max(maxY, y0, y1);
  }
  if (minX === Infinity) return null;
  return screenBox(minX, minY, maxX, maxY, m);
}

/** The AABB of the local rect's corners taken through `m`. */
export function screenBox(x0: number, y0: number, x1: number, y1: number, m: GlMat3): ScreenBox {
  const [ax, ay] = mat3.apply(m, x0, y0);
  const [bx, by] = mat3.apply(m, x1, y0);
  const [cx, cy] = mat3.apply(m, x1, y1);
  const [dx, dy] = mat3.apply(m, x0, y1);
  return {
    minX: Math.min(ax, bx, cx, dx), minY: Math.min(ay, by, cy, dy),
    maxX: Math.max(ax, bx, cx, dx), maxY: Math.max(ay, by, cy, dy),
  };
}
