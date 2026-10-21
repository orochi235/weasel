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
  /**
   * How far, in device pixels, the pass can carry a pixel from where it was
   * drawn — a blur's radius. Unset when its result depends on more than the
   * pixels that near, such as where in the buffer it is: such a pass is
   * bounded only by the buffer, and so is every group that runs it.
   */
  reach?: number;
}

/**
 * How far, in device pixels, `effects` run in order can carry a pixel from
 * where a group drew it: the sum of each pass's `reach`, and `Infinity` when
 * any pass leaves it unset. A group's effects change nothing outside its
 * painted bounds grown by this much.
 */
export function effectsReach(effects: readonly Effect[]): number {
  let total = 0;
  for (const effect of effects) {
    if (effect.reach === undefined || !(effect.reach >= 0)) return Infinity;
    total += effect.reach;
  }
  return total;
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
