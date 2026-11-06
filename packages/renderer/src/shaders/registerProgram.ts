/**
 * Public API for registering custom shader programs. Module-level state is
 * source strings only; each WeaselRenderer compiles them into its own
 * programRegistry, which keeps registration GL-context-agnostic. Program
 * sources live for the module lifetime.
 */

import { createReflectable, isDev, type Reflection } from '@weasel-js/registry';
import { type TextureHandle } from '../textures/registerTexture';

export type { TextureHandle };

/** Opaque handle to a compiled custom shader program. */
export interface ShaderProgramHandle {
  readonly id: string;
}

/**
 * A value for one uniform in `ShaderDrawCommand.uniforms`.
 *
 * | TS type                 | GL call                              |
 * |-------------------------|--------------------------------------|
 * | number                  | uniform1f                            |
 * | [n, n]                  | uniform2fv                           |
 * | [n, n, n]               | uniform3fv                           |
 * | [n, n, n, n]            | uniform4fv                           |
 * | Float32Array length 9   | uniformMatrix3fv (column-major)      |
 * | Float64Array            | as the Float32Array of its values    |
 * | Float32Array length 16  | uniformMatrix4fv (column-major)      |
 * | TextureHandle           | bind to next tex unit + uniform1i    |
 *
 * **Array uniforms.** Keyed by an array's bare name (`u_ripples` for
 * `uniform vec3 u_ripples[8]`), a flat `number[]`, `Float32Array`,
 * `Int32Array` or `Uint32Array` fills the array from slot 0 in one
 * `uniform*v` call chosen by the declared element type (`vec3` →
 * `uniform3fv`, `ivec2` → `uniform2iv`, `mat4` → `uniformMatrix4fv`, …).
 * Its length must be a whole number of elements and at most the declared
 * size; a shorter value leaves the remaining slots as they were. Per-slot
 * keys (`u_ripples[2]`) keep working and take the table above.
 */
export type ShaderUniform =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | readonly number[]
  | Float32Array
  | Float64Array
  | Int32Array
  | Uint32Array
  | TextureHandle;

/** A shading language a program's source can be written in: GLSL ES 3.0 for WebGL 2, WGSL for WebGPU. */
export type ShaderLanguage = 'glsl' | 'wgsl';

/** One language's stages of a program. No `vert` means the kit's default vertex shader. */
export interface ShaderSource {
  vert?: string;
  frag: string;
}

/**
 * A registered program's source, in one shading language or both. A backend
 * draws from its own language's and declines a program without one.
 *
 * WGSL sources are held but not yet drawn: no backend reads them until the
 * WebGPU one lands, and their contract (bindings for the kit's uniforms and
 * varyings) is set with it.
 */
export type ProgramSource =
  | { glsl: ShaderSource; wgsl?: ShaderSource }
  | { glsl?: ShaderSource; wgsl: ShaderSource };

/** Whether `a` and `b` hold the same source in every language. */
export function sameProgramSource(a: ProgramSource, b: ProgramSource): boolean {
  const same = (x?: ShaderSource, y?: ShaderSource) => x === y
    || (x !== undefined && y !== undefined && x.frag === y.frag && x.vert === y.vert);
  return same(a.glsl, b.glsl) && same(a.wgsl, b.wgsl);
}

const registry = createReflectable<ProgramSource>();

/** Every registered program's GLSL source, keyed by program id. */
export const programSourceRegistry: Reflection<ProgramSource> = registry.reflection;

/** @internal Test helper — do not call from product code. */
export function _resetProgramRegistryForTests(): void {
  registry.clear();
}

/** The source registered under `id`, or `null` when nothing is. */
export function getProgramSource(id: string): ProgramSource | null {
  return registry.get(id) ?? null;
}


/**
 * Register a custom shader program by id.
 *
 * `source` holds a GLSL program, a WGSL one, or both: each renderer compiles
 * its own backend's language and draws nothing for a program lacking it,
 * logging that once. Leave out `vert` to use the kit's default vertex shader
 * (recommended):
 *
 * ```ts
 * registerProgram('stripes', { glsl: { frag: STRIPES_GLSL } });
 * ```
 *
 * The kit's GLSL vertex shader exposes `v_uv`, `v_screen`, `v_world`
 * and `v_worldLocal` varyings plus `u_bounds`, `u_view` and `u_worldOrigin`
 * uniforms. Far from the origin `v_world` is as coarse as any float32 that
 * size; `v_worldLocal` is the same point measured from `u_worldOrigin`, a
 * world point near the bounds, and stays exact, so a shader drawing detail
 * there reads it (a periodic one, `mod(u_worldOrigin, P) + v_worldLocal`).
 *
 * **`gl_FragCoord`** counts from the corner of whatever buffer the draw lands
 * in, which is not always the canvas's: a renderer confined to a tile of a
 * shared canvas, a group's effects and a retained layer's surface each move
 * it. A fragment shader reading it declares `uniform vec2 u_fragOrigin;` and
 * reads `gl_FragCoord.xy - u_fragOrigin`, the device pixel from the bottom
 * left of the renderer's own drawing buffer. A program reading `gl_FragCoord`
 * without declaring `u_fragOrigin` makes a retained layer holding it keep a
 * surface the size of the whole drawing buffer.
 *
 * **IMPORTANT — Premultiplied alpha:**
 * Your fragment shader MUST output premultiplied alpha:
 *   `outColor = vec4(rgb * a, a);`  ← correct
 *   `outColor = vec4(rgb, a);`      ← WRONG — over-brightens translucent regions
 *
 * The renderer blends premultiplied (`ONE, ONE_MINUS_SRC_ALPHA`) to match.
 * Opaque fragments (a=1) are unaffected; only fragments with a < 1 differ.
 *
 * **Re-registration behavior:**
 * - Dev mode (`NODE_ENV !== 'production'`): calling with an existing id and new
 *   source replaces it (hot reload). Every renderer that compiled the old source
 *   recompiles on its next frame and deletes the program it replaces; a
 *   `<Canvas shaders>` naming the id repaints to show it. If the new source fails
 *   to compile, the renderer logs the error once and keeps drawing the old one.
 * - Prod mode: calling with an existing id throws.
 *
 * Nothing compiles here. A renderer compiles the source the first time it
 * draws with it and reports a failure to the console, drawing nothing for
 * that command; `WeaselRenderer.registerProgram()` compiles ahead of that and
 * throws `ShaderCompileError`.
 */
export function registerProgram(id: string, source: ProgramSource): ShaderProgramHandle {
  if (registry.has(id) && !isDev()) {
    throw new Error(`weasel registerProgram: duplicate program id "${id}". ` +
      `In production, re-registration is not allowed. Pass a unique id or call in dev mode.`);
  }
  if (!source.glsl && !source.wgsl) {
    throw new Error(`weasel registerProgram: program "${id}" has no source; pass \`glsl\`, \`wgsl\` or both.`);
  }
  registry.set(id, source);
  return { id };
}
