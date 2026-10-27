import type { ShaderDrawCommand } from '../DrawCommand';
import { getTexture, type TextureHandle } from '../textures/registerTexture';
import type { ShaderUniform } from '../shaders/registerProgram';
import type { GLTextureCache } from '../cache/GLTextureCache';
import type { ShaderProgram, UniformArray } from '../shaders/ShaderProgram';
import { mat3 } from '@weasel-js/geom';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { applyClipTest } from './stencil';
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

/**
 * Bind a single ShaderUniform value to a GL uniform location.
 *
 * Type detection order:
 *   1. TextureHandle (object with string `.id`) — bind to next tex unit, set sampler.
 *   2. Float32Array — length 9 → mat3, length 16 → mat4. Other lengths throw in dev.
 *   3. Array — uniform2fv / uniform3fv / uniform4fv based on length.
 *   4. number — uniform1f.
 */
export function setUniform(
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation,
  value: ShaderUniform,
  textureCache: GLTextureCache,
  nextTexUnit: { value: number },
): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Float32Array)
      && 'id' in value && typeof (value as TextureHandle).id === 'string') {
    const handle = value as TextureHandle;
    const entry = getTexture(handle.id);
    if (!entry) {
      if (isDev()) console.warn(`weasel setUniform: TextureHandle "${handle.id}" not registered`);
      return;
    }
    const unit = nextTexUnit.value++;
    // An upload binds and unbinds on the active unit, so it has to be this
    // uniform's own unit and not one an earlier sampler already holds.
    gl.activeTexture(gl.TEXTURE0 + unit);
    textureCache.uploadRegistered(handle.id, entry.source);
    textureCache.bind(handle.id, unit);
    gl.uniform1i(loc, unit);
    return;
  }

  // A kit matrix is in doubles; GL wants float32.
  if (value instanceof Float64Array) value = Float32Array.from(value);

  if (value instanceof Float32Array) {
    if (value.length === 9) {
      gl.uniformMatrix3fv(loc, false, value);
    } else if (value.length === 16) {
      gl.uniformMatrix4fv(loc, false, value);
    } else {
      if (isDev()) throw new TypeError(`weasel setUniform: Float32Array must be length 9 (mat3) or 16 (mat4), got ${value.length}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    const arr = value as readonly number[];
    switch (arr.length) {
      case 2: gl.uniform2fv(loc, arr as [number, number]); break;
      case 3: gl.uniform3fv(loc, arr as [number, number, number]); break;
      case 4: gl.uniform4fv(loc, arr as [number, number, number, number]); break;
      default: {
        if (isDev()) throw new TypeError(`weasel setUniform: array length ${arr.length} not supported`);
      }
    }
    return;
  }

  if (typeof value === 'number') {
    gl.uniform1f(loc, value);
    return;
  }
}

/** How an array's element type is uploaded: the `uniform*v` call and the
 *  number of components per element. */
const ARRAY_UPLOADS: Readonly<Record<string, { fn: string; n: number; matrix?: true }>> = {
  float: { fn: 'uniform1fv', n: 1 }, vec2: { fn: 'uniform2fv', n: 2 },
  vec3: { fn: 'uniform3fv', n: 3 }, vec4: { fn: 'uniform4fv', n: 4 },
  int: { fn: 'uniform1iv', n: 1 }, ivec2: { fn: 'uniform2iv', n: 2 },
  ivec3: { fn: 'uniform3iv', n: 3 }, ivec4: { fn: 'uniform4iv', n: 4 },
  bool: { fn: 'uniform1iv', n: 1 }, bvec2: { fn: 'uniform2iv', n: 2 },
  bvec3: { fn: 'uniform3iv', n: 3 }, bvec4: { fn: 'uniform4iv', n: 4 },
  uint: { fn: 'uniform1uiv', n: 1 }, uvec2: { fn: 'uniform2uiv', n: 2 },
  uvec3: { fn: 'uniform3uiv', n: 3 }, uvec4: { fn: 'uniform4uiv', n: 4 },
  mat2: { fn: 'uniformMatrix2fv', n: 4, matrix: true },
  mat3: { fn: 'uniformMatrix3fv', n: 9, matrix: true },
  mat4: { fn: 'uniformMatrix4fv', n: 16, matrix: true },
  mat2x2: { fn: 'uniformMatrix2fv', n: 4, matrix: true },
  mat3x3: { fn: 'uniformMatrix3fv', n: 9, matrix: true },
  mat4x4: { fn: 'uniformMatrix4fv', n: 16, matrix: true },
  mat2x3: { fn: 'uniformMatrix2x3fv', n: 6, matrix: true },
  mat2x4: { fn: 'uniformMatrix2x4fv', n: 8, matrix: true },
  mat3x2: { fn: 'uniformMatrix3x2fv', n: 6, matrix: true },
  mat3x4: { fn: 'uniformMatrix3x4fv', n: 12, matrix: true },
  mat4x2: { fn: 'uniformMatrix4x2fv', n: 8, matrix: true },
  mat4x3: { fn: 'uniformMatrix4x3fv', n: 12, matrix: true },
};

type ArrayValue = readonly number[] | Float32Array | Int32Array | Uint32Array;

function isArrayValue(value: ShaderUniform): value is ArrayValue {
  return Array.isArray(value) || value instanceof Float32Array
    || value instanceof Int32Array || value instanceof Uint32Array;
}

/** Fill an array uniform from slot 0 with one call. Throws in dev on a value
 *  that is not a whole number of elements or overruns the declaration. */
function setUniformArray(
  gl: WebGL2RenderingContext,
  name: string,
  arr: UniformArray,
  value: ArrayValue,
): void {
  const upload = ARRAY_UPLOADS[arr.type];
  if (!upload) {
    if (isDev()) console.warn(`weasel setUniform: array uniform "${name}" has type ${arr.type}, which cannot be written as a whole`);
    return;
  }
  if (value.length % upload.n !== 0 || value.length > upload.n * arr.size) {
    if (isDev()) {
      throw new TypeError(
        `weasel setUniform: "${name}" is ${arr.type}[${arr.size}], so its value must hold a multiple of ${upload.n} `
        + `numbers, at most ${upload.n * arr.size}; got ${value.length}`,
      );
    }
    return;
  }
  if (value.length === 0) return;
  const fn = (gl as unknown as Record<string, (...args: unknown[]) => void>)[upload.fn];
  if (upload.matrix) fn.call(gl, arr.location, false, value);
  else fn.call(gl, arr.location, value);
}

/** Write every entry of a command's `uniforms` map. A key naming an array
 *  uniform with an array value fills the array; anything else goes to the
 *  location of that exact name. */
export function setUniforms(
  gl: WebGL2RenderingContext,
  program: ShaderProgram,
  programId: string,
  uniforms: Record<string, ShaderUniform>,
  textureCache: GLTextureCache,
  nextTexUnit: { value: number },
): void {
  for (const [name, value] of Object.entries(uniforms)) {
    const arr = program.uniformArray(name);
    if (arr && isArrayValue(value)) {
      setUniformArray(gl, name, arr, value);
      continue;
    }
    const loc = program.uniform(name);
    if (loc === undefined) {
      warnOnceUniform(programId, name);
      continue;
    }
    setUniform(gl, loc, value, textureCache, nextTexUnit);
  }
}

export function drawShader(ctx: DrawContext, cmd: ShaderDrawCommand): void {
  const { gl, programRegistry, quadVbo, quadIbo, textureCache } = ctx;

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
  if (!quadVbo || !quadIbo) {
    console.warn('weasel drawShader: quad geometry not initialized');
    return;
  }

  gl.useProgram(program.handle);

  const aPosLoc = program.attribute('a_position');
  const aUvLoc  = program.attribute('a_uv');

  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 16, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, 16, 8);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIbo);

  const uProj = program.uniform('u_proj');
  if (uProj !== undefined) gl.uniformMatrix3fv(uProj, false, mat3.toUniform(projFor(ctx)));

  const uBounds = program.uniform('u_bounds');
  if (uBounds !== undefined) {
    gl.uniform4f(uBounds, cmd.bounds.x, cmd.bounds.y, cmd.bounds.w, cmd.bounds.h);
  }

  const uOrigin = program.uniform('u_fragOrigin');
  if (uOrigin !== undefined) {
    const [ox, oy] = (ctx.renderTarget ? ctx.renderTarget.fragOrigin : ctx.fragOrigin) ?? [0, 0];
    gl.uniform2f(uOrigin, ox, oy);
  }

  const uView = program.uniform('u_view');
  if (uView !== undefined) gl.uniformMatrix3fv(uView, false, mat3.toUniform(ctx.state.transform));

  setUniforms(gl, program, cmd.program.id, cmd.uniforms, textureCache, { value: 1 });

  applyClipTest(ctx);
  drawTriangles(ctx, 6, ctx.gl.UNSIGNED_SHORT);

  if (aPosLoc !== undefined) gl.disableVertexAttribArray(aPosLoc);
  if (aUvLoc  !== undefined) gl.disableVertexAttribArray(aUvLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}
