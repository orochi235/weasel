/** The buffer an id frame draws into, and reading its ids back. */
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { cullDrawCommands } from '../cullDrawCommands';
import type { EffectTargets } from '../effects/EffectTargets';
import type { IdBuffer, RenderIdsOptions } from '../rendererTypes';
import { ID_ATTRIBUTE_LOCATION, idOfTexel } from '../shaders/idOutput';
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
 * ids there are read back top-down. GL's blend and the renderer's other
 * frame state are the caller's to have set.
 */
export function drawIdFrame(
  gl: WebGL2RenderingContext, targets: EffectTargets, composite: ShaderProgram, spec: IdFrameSpec,
  commands: DrawCommand[], draw: (root: RootTarget, ids: IdFrame, commands: DrawCommand[]) => void,
): IdBuffer {
  const minAlpha = spec.minAlpha ?? DEFAULT_MIN_ALPHA;
  if (!(minAlpha >= 0 && minAlpha <= 1)) {
    throw new RangeError(`renderIds: minAlpha must be from 0 to 1, got ${minAlpha}`);
  }
  const read = idReadRect(spec);
  const data = new Uint32Array(read.width * read.height);
  if (data.length === 0) return { ...read, data };
  const { width, height } = spec;
  const kept = spec.exclude && spec.exclude.size > 0 ? withoutPickIds(commands, spec.exclude) : commands;
  const culled = spec.rect ? cullDrawCommands(kept, mat3.identity(), spec.rect, spec.dpr) : kept;
  const target = targets.acquire(width, height, true);
  const glY = height - read.y - read.height;
  const restore = (): void => {
    gl.viewport(0, 0, width, height);
    gl.scissor(read.x, glY, read.width, read.height);
    gl.enable(gl.SCISSOR_TEST);
  };
  const ids: IdFrame = { minAlpha, targets: targets.idFbos, lastId: -1, composite };
  const bytes = new Uint8Array(data.length * 4);
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    restore();
    gl.stencilMask(0xFF);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    draw({ fbo: target.fbo, restore, fragOrigin: [0, 0], window: { x: 0, y: 0, width, height } }, ids, culled);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(read.x, glY, read.width, read.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
  } finally {
    gl.disable(gl.SCISSOR_TEST);
    gl.vertexAttrib4f(ID_ATTRIBUTE_LOCATION, 0, 0, 0, 1);
    targets.release(target);
  }
  // GL's rows run bottom-up.
  for (let row = 0; row < read.height; row++) {
    const src = (read.height - 1 - row) * read.width * 4;
    const dst = row * read.width;
    for (let col = 0; col < read.width; col++) data[dst + col] = idOfTexel(bytes, src + col * 4);
  }
  return { ...read, data };
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
