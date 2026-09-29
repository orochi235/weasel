/**
 * registerProgram — public API for registering custom shader programs.
 *
 * Stores raw GLSL source strings in a module-level registry. GL compilation
 * happens on each WeaselRenderer via WeaselRenderer.registerProgram(), which
 * calls getProgramSource() and compiles the result. This keeps registerProgram
 * GL-context-agnostic — identical pattern to registerFont storing ImageBitmap.
 *
 * Module-level state = source strings only; compiled GL
 * programs live on each renderer's programRegistry (Map<id, ShaderProgram>).
 *
 * Lifecycle: program sources live for the module lifetime. No unregister in v1.
 */

import { createReflectable, type Reflection } from '@weasel-js/registry';
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
  | Int32Array
  | Uint32Array
  | TextureHandle;

/** A registered program's GLSL source. An empty `vert` means the kit's default vertex shader. */
export interface ProgramSource {
  vert: string;
  frag: string;
}

const registry = createReflectable<ProgramSource>();

/** Every registered program's GLSL source, keyed by program id. */
export const programSourceRegistry: Reflection<ProgramSource> = registry.reflection;

/** @internal Test helper — do not call from product code. */
export function _resetProgramRegistryForTests(): void {
  registry.clear();
}

export function getProgramSource(id: string): ProgramSource | null {
  return registry.get(id) ?? null;
}

const isDev = (): boolean =>
  typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;

/**
 * Register a custom shader program by id.
 *
 * Pass an empty string for `vert` to use the kit's default vertex shader
 * (recommended). The kit's vertex shader exposes `v_uv`, `v_screen`, and
 * `v_world` varyings plus `u_bounds` and `u_view` uniforms.
 *
 * **IMPORTANT — Premultiplied alpha:**
 * Your fragment shader MUST output premultiplied alpha:
 *   `outColor = vec4(rgb * a, a);`  ← correct
 *   `outColor = vec4(rgb, a);`      ← WRONG — over-brightens translucent regions
 *
 * The renderer uses `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` to match.
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
 * Actual GL compilation and `ShaderCompileError` throwing happen in
 * `WeaselRenderer.registerProgram()`, not here.
 *
 * @experimental API may break before v2.
 */
export function registerProgram(
  id: string,
  vert: string,
  frag: string,
): ShaderProgramHandle {
  if (registry.has(id) && !isDev()) {
    throw new Error(`weasel registerProgram: duplicate program id "${id}". ` +
      `In production, re-registration is not allowed. Pass a unique id or call in dev mode.`);
  }
  registry.set(id, { vert, frag });
  return { id };
}
