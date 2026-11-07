import {
  registerProgram, type ProgramSource, type ShaderProgramHandle, type ShaderUniform,
} from '../shaders/registerProgram';
import { EFFECT_VERT_SRC } from './effectPrelude';
import { assembleEffectWgsl } from '../gpu/webgpu/wgsl/effectPrelude';

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
   * pixels that near, such as how far it lies from the buffer's edges: such a
   * pass is bounded only by the buffer, and so is every group that runs it.
   */
  reach?: number;
  /**
   * The pass's result depends on where in the drawing buffer each pixel lies
   * (it reads `u_windowOrigin`), as a Bayer dither picks its cell: its output
   * cannot be moved with a pan, so a group running it is drawn again instead.
   */
  screenAnchored?: boolean;
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

/** An effect's fragment shader, in GLSL, WGSL or both; the kit supplies each vertex stage. */
export type EffectProgramSource =
  | { glsl: string; wgsl?: string }
  | { glsl?: string; wgsl: string };

/**
 * Register a fragment shader as an effect. An effect registered through
 * `registerProgram` with the *custom-shader* vertex shader compiles, runs, and
 * samples its source upside down.
 *
 * The GLSL fragment shader reads `v_uv` and `u_source`, may declare
 * `u_resolution` / `u_texel`, and must write premultiplied alpha. See
 * `effectPrelude.ts`. The WGSL one supplies `fn effect(in: EffectVaryings) -> vec4f`
 * (`gpu/webgpu/wgsl/effectPrelude.ts`); each backend draws an effect from its
 * own language alone.
 */
export function registerEffect(id: string, source: EffectProgramSource): ShaderProgramHandle {
  if (source.glsl === undefined && source.wgsl === undefined) {
    throw new Error(`weasel registerEffect: effect "${id}" has no source; pass \`glsl\`, \`wgsl\` or both.`);
  }
  return registerProgram(id, {
    ...(source.glsl !== undefined && { glsl: { vert: EFFECT_VERT_SRC, frag: source.glsl } }),
    ...(source.wgsl !== undefined && { wgsl: { frag: assembleEffectWgsl(source.wgsl) } }),
  } as ProgramSource);
}
