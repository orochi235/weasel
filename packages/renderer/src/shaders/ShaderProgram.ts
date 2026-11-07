/**
 * What the draw code knows of a compiled program: the GPU layer's handle.
 * Each backend builds its own (`gpu/webgl/GlProgram.ts`).
 */
import type { GpuProgram, GpuUniformArray } from '../gpu/types';

/** The step of building a program that a `ShaderCompileError` came from. */
export type ShaderStage = 'vertex' | 'fragment' | 'link';

/** Thrown when a shader fails to compile or link, carrying which stage failed
 *  and the driver's log. */
export class ShaderCompileError extends Error {
  constructor(public readonly stage: ShaderStage, public readonly log: string) {
    super(`shader ${stage} failure: ${log}`);
    this.name = 'ShaderCompileError';
  }
}

/** An array uniform a program can be written as a whole: its element type as
 *  declared and its declared length. */
export type UniformArray = GpuUniformArray;

/** Where every program links `a_position`. A mesh's geometry is built once and
 *  drawn with whichever fill program its paint picks, so the location cannot
 *  be left to each program's linker. */
export const POSITION_ATTRIBUTE_LOCATION = 0;

/** A linked program, its uniforms and textures set by name. */
export type ShaderProgram = GpuProgram;
