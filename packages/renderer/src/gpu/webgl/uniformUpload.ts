import type { GpuUniformData, GpuUniformType } from '../types';

/** The `uniform*v` call each element type is written with, and whether it
 *  takes a transpose flag. */
const UPLOADS: Readonly<Record<GpuUniformType, { fn: string; matrix?: true }>> = {
  float: { fn: 'uniform1fv' }, vec2: { fn: 'uniform2fv' }, vec3: { fn: 'uniform3fv' }, vec4: { fn: 'uniform4fv' },
  int: { fn: 'uniform1iv' }, ivec2: { fn: 'uniform2iv' }, ivec3: { fn: 'uniform3iv' }, ivec4: { fn: 'uniform4iv' },
  bool: { fn: 'uniform1iv' }, bvec2: { fn: 'uniform2iv' }, bvec3: { fn: 'uniform3iv' }, bvec4: { fn: 'uniform4iv' },
  uint: { fn: 'uniform1uiv' }, uvec2: { fn: 'uniform2uiv' }, uvec3: { fn: 'uniform3uiv' }, uvec4: { fn: 'uniform4uiv' },
  mat2: { fn: 'uniformMatrix2fv', matrix: true },
  mat3: { fn: 'uniformMatrix3fv', matrix: true },
  mat4: { fn: 'uniformMatrix4fv', matrix: true },
  mat2x2: { fn: 'uniformMatrix2fv', matrix: true },
  mat3x3: { fn: 'uniformMatrix3fv', matrix: true },
  mat4x4: { fn: 'uniformMatrix4fv', matrix: true },
  mat2x3: { fn: 'uniformMatrix2x3fv', matrix: true },
  mat2x4: { fn: 'uniformMatrix2x4fv', matrix: true },
  mat3x2: { fn: 'uniformMatrix3x2fv', matrix: true },
  mat3x4: { fn: 'uniformMatrix3x4fv', matrix: true },
  mat4x2: { fn: 'uniformMatrix4x2fv', matrix: true },
  mat4x3: { fn: 'uniformMatrix4x3fv', matrix: true },
};

/** Write `data` to `loc` as `type`, from component `offset` for `count`
 *  components, or all of it. */
export function setUniformData(
  gl: WebGL2RenderingContext, loc: WebGLUniformLocation, type: GpuUniformType,
  data: GpuUniformData, offset?: number, count?: number,
): void {
  const upload = UPLOADS[type];
  const fn = (gl as unknown as Record<string, (...args: unknown[]) => void>)[upload.fn];
  const ranged = offset !== undefined || count !== undefined;
  const args: unknown[] = upload.matrix ? [loc, false, data] : [loc, data];
  if (ranged) args.push(offset ?? 0, count ?? data.length - (offset ?? 0));
  fn.apply(gl, args);
}
