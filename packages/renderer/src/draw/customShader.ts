import type { ShaderDrawCommand } from '../DrawCommand';
import { getTexture, type TextureHandle } from '../textures/registerTexture';
import type { ShaderUniform } from '../shaders/registerProgram';
import type { ShaderProgram, UniformArray } from '../shaders/ShaderProgram';
import type { GpuTexture } from '../gpu/types';
import { UNIFORM_COMPONENTS, isUniformType } from '../gpu/uniformTypes';
import { quadGeometry } from './quad';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { clipTest } from './stencil';
import { projFor } from './uniforms';
import { isDev } from '@weasel-js/registry';

const warnedUniforms = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warnedUniforms.has(key)) return;
  warnedUniforms.add(key);
  if (isDev()) console.warn(message);
}

export function warnOnceUniform(programId: string, name: string): void {
  warnOnce(
    `${programId}:${name}`,
    `weasel drawShader: uniform "${name}" not found in program "${programId}". ` +
    `Check spelling, ensure it's used in the shader (unused uniforms are optimized away by the driver).`,
  );
}

type UniformValue = ShaderUniform | GpuTexture;

function isGpuTexture(value: UniformValue): value is GpuTexture {
  return typeof value === 'object' && value !== null && (value as GpuTexture).kind === 'texture';
}

/**
 * Write one uniform value under `name`.
 *
 * Type detection order:
 *   1. A texture: a `GpuTexture`, or a registered TextureHandle (object with
 *      string `.id`), uploaded first.
 *   2. Float32Array — length 9 → mat3, length 16 → mat4. Other lengths throw in dev.
 *   3. Array — vec2 / vec3 / vec4 by length.
 *   4. number — float.
 */
export function setUniform(ctx: DrawContext, program: ShaderProgram, name: string, value: UniformValue): void {
  if (isGpuTexture(value)) {
    program.setTexture(name, value);
    return;
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Float32Array)
      && 'id' in value && typeof (value as TextureHandle).id === 'string') {
    const handle = value as TextureHandle;
    const entry = getTexture(handle.id);
    if (!entry) {
      if (isDev()) console.warn(`weasel setUniform: TextureHandle "${handle.id}" not registered`);
      return;
    }
    ctx.textureCache.uploadRegistered(handle.id, entry.source);
    program.setTexture(name, ctx.textureCache.texture(handle.id));
    return;
  }

  // A kit matrix is in doubles; the GPU wants float32.
  if (value instanceof Float64Array) value = Float32Array.from(value);

  if (value instanceof Float32Array) {
    if (value.length === 9) {
      program.set(name, 'mat3', value);
    } else if (value.length === 16) {
      program.set(name, 'mat4', value);
    } else {
      if (isDev()) throw new TypeError(`weasel setUniform: Float32Array must be length 9 (mat3) or 16 (mat4), got ${value.length}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    const arr = value as readonly number[];
    switch (arr.length) {
      case 2: program.set(name, 'vec2', arr); break;
      case 3: program.set(name, 'vec3', arr); break;
      case 4: program.set(name, 'vec4', arr); break;
      default: {
        if (isDev()) throw new TypeError(`weasel setUniform: array length ${arr.length} not supported`);
      }
    }
    return;
  }

  if (typeof value === 'number') program.set1f(name, value);
}

type ArrayValue = readonly number[] | Float32Array | Int32Array | Uint32Array;

function isArrayValue(value: UniformValue): value is ArrayValue {
  return Array.isArray(value) || value instanceof Float32Array
    || value instanceof Int32Array || value instanceof Uint32Array;
}

/** Fill an array uniform from slot 0 with one write. Throws in dev on a value
 *  that is not a whole number of elements or overruns the declaration. */
function setUniformArray(program: ShaderProgram, name: string, arr: UniformArray, value: ArrayValue): void {
  const { type } = arr;
  if (!isUniformType(type)) {
    if (isDev()) console.warn(`weasel setUniform: array uniform "${name}" has type ${type}, which cannot be written as a whole`);
    return;
  }
  const n = UNIFORM_COMPONENTS[type];
  if (value.length % n !== 0 || value.length > n * arr.size) {
    if (isDev()) {
      throw new TypeError(
        `weasel setUniform: "${name}" is ${type}[${arr.size}], so its value must hold a multiple of ${n} `
        + `numbers, at most ${n * arr.size}; got ${value.length}`,
      );
    }
    return;
  }
  if (value.length === 0) return;
  program.set(name, type, value);
}

/** Write every entry of a command's `uniforms` map. A key naming an array
 *  uniform with an array value fills the array; anything else goes to the
 *  uniform of that exact name. A name the program lacks is reported once
 *  when `warn` is set. */
export function setUniforms(
  ctx: DrawContext,
  program: ShaderProgram,
  programId: string,
  uniforms: Readonly<Record<string, UniformValue>>,
  warn = true,
): void {
  for (const [name, value] of Object.entries(uniforms)) {
    const arr = program.array(name);
    if (arr && isArrayValue(value)) {
      setUniformArray(program, name, arr, value);
      continue;
    }
    if (!program.has(name)) {
      if (warn) warnOnceUniform(programId, name);
      continue;
    }
    setUniform(ctx, program, name, value);
  }
}

export function drawShader(ctx: DrawContext, cmd: ShaderDrawCommand): void {
  const { programRegistry } = ctx;

  const program = ctx.ensureProgram?.(cmd.program.id) ?? programRegistry.get(cmd.program.id);
  if (!program) {
    warnOnce(
      `${cmd.program.id}:(program)`,
      `weasel drawShader: program "${cmd.program.id}" has no compiled program on this ` +
      'renderer. Register its source with the module-level registerProgram() first; a ' +
      'source that failed to compile is reported above.',
    );
    return;
  }
  const geometry = quadGeometry(ctx, program);
  if (!geometry) {
    console.warn('weasel drawShader: quad geometry not initialized');
    return;
  }

  if (program.has('u_proj')) program.set('u_proj', 'mat3', mat3.toUniform(projFor(ctx)));
  program.set4f('u_bounds', cmd.bounds.x, cmd.bounds.y, cmd.bounds.w, cmd.bounds.h);
  const [ox, oy] = (ctx.renderTarget ? ctx.renderTarget.fragOrigin : ctx.fragOrigin) ?? [0, 0];
  program.set2f('u_fragOrigin', ox, oy);
  // WGSL's is the same corner counted from the top of the buffer drawn in.
  const bufferHeight = ctx.renderTarget?.pass.target?.height ?? ctx.gpu.canvasSize().height;
  program.set2f('u_fragOriginTop', ox, bufferHeight - oy - (ctx.deviceHeight ?? 0));
  if (program.has('u_view')) program.set('u_view', 'mat3', mat3.toUniform(ctx.state.transform));
  setWorldFrame(program, ctx.state.transform, cmd.bounds);

  setUniforms(ctx, program, cmd.program.id, cmd.uniforms);

  drawTriangles(ctx, program, geometry, 6, { stencil: clipTest(ctx.clipDepth) });
}

/**
 * `u_worldOrigin` and `u_screenToLocal`: the world point under the bounds'
 * corner, rounded to a float32, and the screen-to-world map measured from it,
 * composed in doubles. Far from the origin at high zoom the view's
 * translation is millions of pixels, and an inverse taken in the shader
 * subtracts two such numbers. A view with no inverse sends zeros, so every
 * fragment reads the world origin rather than a plausible wrong mapping.
 */
function setWorldFrame(program: ShaderProgram, view: GlMat3, bounds: ShaderDrawCommand['bounds']): void {
  const uLocal = program.has('u_screenToLocal');
  const uOrigin = program.has('u_worldOrigin');
  if (!uLocal && !uOrigin) return;
  const inverse = mat3.invert(view);
  let ox = 0;
  let oy = 0;
  let local: GlMat3 = mat3.scaled(mat3.identity(), 0, 0);
  if (inverse) {
    const wx = inverse[0] * bounds.x + inverse[3] * bounds.y + inverse[6];
    const wy = inverse[1] * bounds.x + inverse[4] * bounds.y + inverse[7];
    if (Math.abs(wx) >= WORLD_REBASE || Math.abs(wy) >= WORLD_REBASE) {
      ox = Math.fround(wx);
      oy = Math.fround(wy);
    }
    local = mat3.multiply(mat3.translated(mat3.identity(), -ox, -oy), inverse);
  }
  if (uLocal) program.set('u_screenToLocal', 'mat3', mat3.toUniform(local));
  if (uOrigin) program.set2f('u_worldOrigin', ox, oy);
}

/** A world point at or past this is coarser than 1/1024 of a unit as a float32. */
const WORLD_REBASE = 8192;
