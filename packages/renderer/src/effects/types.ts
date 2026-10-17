import { registerProgram, type ShaderProgramHandle, type ShaderUniform } from '../shaders/registerProgram';
import { EFFECT_VERT_SRC } from './effectPrelude';

/**
 * One full-screen pass over what a group has already drawn. A group's effects
 * run in order, each reading the previous one's output through `u_source`.
 *
 * `uniforms` are the effect's own; `u_source`, `u_resolution`, and `u_texel`
 * come from the renderer and must not be passed here.
 */
export interface Effect {
  program: ShaderProgramHandle;
  uniforms?: Record<string, ShaderUniform>;
}

/**
 * Register a fragment shader as an effect. An effect registered through
 * `registerProgram` with the *custom-shader* vertex shader compiles, runs, and
 * samples its source upside down.
 *
 * The fragment shader reads `v_uv` and `u_source`, may declare `u_resolution` /
 * `u_texel`, and must write premultiplied alpha. See `effectPrelude.ts`.
 */
export function registerEffect(id: string, frag: string): ShaderProgramHandle {
  return registerProgram(id, EFFECT_VERT_SRC, frag);
}
