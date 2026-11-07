import type { GpuUniformType } from './types';

/** Components per element of each uniform type. */
export const UNIFORM_COMPONENTS: Readonly<Record<GpuUniformType, number>> = {
  float: 1, vec2: 2, vec3: 3, vec4: 4, int: 1, ivec2: 2, ivec3: 3, ivec4: 4,
  uint: 1, uvec2: 2, uvec3: 3, uvec4: 4, bool: 1, bvec2: 2, bvec3: 3, bvec4: 4,
  mat2: 4, mat3: 9, mat4: 16, mat2x2: 4, mat3x3: 9, mat4x4: 16,
  mat2x3: 6, mat2x4: 8, mat3x2: 6, mat3x4: 12, mat4x2: 8, mat4x3: 12,
};

/** Whether `type`, as a shader declares it, is one a uniform array is written as. */
export function isUniformType(type: string): type is GpuUniformType {
  return type in UNIFORM_COMPONENTS;
}
