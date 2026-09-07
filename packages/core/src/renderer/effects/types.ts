import { registerProgram, type ShaderProgramHandle, type ShaderUniform } from '../shaders/registerProgram';
import { EFFECT_VERT_SRC } from './effectPrelude';

/**
 * One full-screen pass over what a group has already drawn.
 *
 * The renderer runs a group's effects in order, each reading the previous
 * one's output through `u_source` and writing a whole new buffer — so an
 * effect is free to read neighbouring pixels, which is the entire point and
 * the one thing `colorMatrix` can never do.
 *
 * `uniforms` are the effect's own; `u_source`, `u_resolution` and `u_texel`
 * come from the renderer and must not be passed here.
 */
export interface Effect {
  program: ShaderProgramHandle;
  uniforms?: Record<string, ShaderUniform>;
}

/**
 * Register a fragment shader as an effect. Sugar over `registerProgram` with
 * the effect vertex shader, and the reason a consumer never imports the
 * prelude: an effect that registers with the *custom-shader* vertex shader
 * compiles, runs, and samples its source upside down.
 *
 * The fragment shader reads `v_uv` and `u_source`, and may declare
 * `u_resolution` / `u_texel`. See `effectPrelude.ts` for the full contract,
 * including the premultiplied-alpha requirement.
 *
 * @experimental
 */
export function registerEffect(id: string, frag: string): ShaderProgramHandle {
  return registerProgram(id, EFFECT_VERT_SRC, frag);
}
