/** The buffer an id frame draws into, and reading its ids back. */
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { cullDrawCommands } from '../cullDrawCommands';
import type { EffectTargets } from '../effects/EffectTargets';
import type { IdBuffer, RenderIdsOptions } from '../rendererTypes';
import { idOfTexel } from '../shaders/idOutput';
import type { GpuDevice } from '../gpu/types';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { DrawContext } from './drawContext';
import type { IdFrame } from './idFrame';

/** Every pixel painted visibly. */
const DEFAULT_MIN_ALPHA = 1 / 255;

/** The drawing an id frame covers: device size and density, and what it was asked for. */
export interface IdFrameSpec extends Pick<RenderIdsOptions, 'rect' | 'minAlpha' | 'exclude'> {
  width: number;
  height: number;
  dpr: number;
}

type RootTarget = NonNullable<DrawContext['renderTarget']>;

/** The device pixels `rect` touches, top-left origin, clamped to the drawing:
 *  at least one pixel for a rect of no size, and none for one off the drawing. */
export function idReadRect(spec: IdFrameSpec): { x: number; y: number; width: number; height: number } {
  const { width, height, dpr, rect } = spec;
  if (!rect) return { x: 0, y: 0, width, height };
  const fx = Math.floor(rect.x * dpr);
  const fy = Math.floor(rect.y * dpr);
  const x0 = Math.max(0, fx);
  const y0 = Math.max(0, fy);
  const x1 = Math.min(width, Math.max(fx + 1, Math.ceil((rect.x + rect.width) * dpr)));
  const y1 = Math.min(height, Math.max(fy + 1, Math.ceil((rect.y + rect.height) * dpr)));
  if (x1 <= x0 || y1 <= y0) return { x: Math.min(x0, width), y: Math.min(y0, height), width: 0, height: 0 };
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Draw an id frame: `draw` dispatches the commands that can reach the rect
 * read into a target holding color and ids, scissored to that rect, and the
 * ids there are read back top-down. `sync` needs a device that reads back at
 * once, and returns the buffer itself; otherwise a promise of it.
 */
export function drawIdFrame(
  gpu: GpuDevice, targets: EffectTargets, composite: ShaderProgram, spec: IdFrameSpec,
  commands: DrawCommand[], draw: (root: RootTarget, ids: IdFrame, commands: DrawCommand[]) => void, sync: boolean,
): IdBuffer | Promise<IdBuffer> {
  const minAlpha = spec.minAlpha ?? DEFAULT_MIN_ALPHA;
  if (!(minAlpha >= 0 && minAlpha <= 1)) {
    throw new RangeError(`renderIds: minAlpha must be from 0 to 1, got ${minAlpha}`);
  }
  const readSync = gpu.readIdsSync;
  if (sync && !readSync) {
    throw new Error('renderIds: this backend reads ids back only asynchronously; call renderIdsAsync instead');
  }
  const read = idReadRect(spec);
  const data = new Uint32Array(read.width * read.height);
  if (data.length === 0) return sync ? { ...read, data } : Promise.resolve({ ...read, data });
  const { width, height } = spec;
  const kept = spec.exclude && spec.exclude.size > 0 ? withoutPickIds(commands, spec.exclude) : commands;
  const culled = spec.rect ? cullDrawCommands(kept, mat3.identity(), spec.rect, spec.dpr) : kept;
  const borrowed = targets.acquire(width, height, true);
  const { target } = borrowed;
  const glRead = { x: read.x, y: height - read.y - read.height, width: read.width, height: read.height };
  const pass = { target, viewport: { x: 0, y: 0, width, height }, scissor: glRead };
  const ids: IdFrame = { minAlpha, composite };
  let bytes: Uint8Array | Promise<Uint8Array>;
  try {
    gpu.beginPass({ ...pass, clear: { color: true, stencil: true } });
    draw({ pass, fragOrigin: [0, 0], window: { x: 0, y: 0, width, height } }, ids, culled);
    gpu.endPass();
    // The read is ordered before anything later drawn into the target, so it
    // can go back to the pool before the bytes arrive.
    bytes = sync ? readSync!(target, glRead) : gpu.readIds(target, glRead);
  } finally {
    gpu.endPass();
    targets.release(borrowed);
  }
  const decode = (texels: Uint8Array): IdBuffer => {
    // Rows run bottom-up.
    for (let row = 0; row < read.height; row++) {
      const src = (read.height - 1 - row) * read.width * 4;
      const dst = row * read.width;
      for (let col = 0; col < read.width; col++) data[dst + col] = idOfTexel(texels, src + col * 4);
    }
    return { ...read, data };
  };
  return bytes instanceof Uint8Array ? decode(bytes) : bytes.then(decode);
}

/** `cmds` without the groups whose `pickId` is in `exclude`; `cmds` itself when none is. */
export function withoutPickIds(cmds: DrawCommand[], exclude: ReadonlySet<number>): DrawCommand[] {
  let out: DrawCommand[] | null = null;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    let next: DrawCommand | null = c;
    if (c.kind === 'group') {
      if (c.pickId !== undefined && exclude.has(c.pickId)) next = null;
      else {
        const children = withoutPickIds(c.children, exclude);
        if (children !== c.children) next = { ...c, children };
      }
    }
    if (next !== c && out === null) out = cmds.slice(0, i);
    if (out !== null && next !== null) out.push(next);
  }
  return out ?? cmds;
}

/**
 * A mask of `buffer`, one byte per pixel in its rows' order, 1 where the id
 * there is one `include` takes and 0 elsewhere: the coverage of those ids, in
 * the shape `ditherPixels`'s `protect` takes.
 */
export function idMask(buffer: IdBuffer, include: ReadonlySet<number> | ((id: number) => boolean)): Uint8Array {
  const takes = typeof include === 'function' ? include : (id: number) => include.has(id);
  const out = new Uint8Array(buffer.data.length);
  for (let i = 0; i < out.length; i++) {
    const id = buffer.data[i];
    if (id !== 0 && takes(id)) out[i] = 1;
  }
  return out;
}
