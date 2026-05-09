/**
 * registerProgram — public API for registering custom shader programs.
 *
 * Stores raw GLSL source strings in a module-level registry. GL compilation
 * happens on each WeaselRenderer via WeaselRenderer.registerProgram(), which
 * calls getProgramSource() and compiles the result. This keeps registerProgram
 * GL-context-agnostic — identical pattern to registerFont storing ImageBitmap.
 *
 * Convention §9: module-level state = source strings only; compiled GL
 * programs live on each renderer's programRegistry (Map<id, ShaderProgram>).
 *
 * Lifecycle: program sources live for the module lifetime. No unregister in v1.
 */

import { type TextureHandle } from '../textures/registerTexture';

export type { TextureHandle };

/** Opaque handle to a compiled custom shader program. */
export interface ShaderProgramHandle {
  readonly id: string;
}

/**
 * Scalar and vector uniform types accepted by the custom shader uniform binder.
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
 */
export type ShaderUniform =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Float32Array
  | TextureHandle;

export interface ProgramSource {
  vert: string;
  frag: string;
}

let registry = new Map<string, ProgramSource>();

/** @internal Test helper — do not call from product code. */
export function _resetProgramRegistryForTests(): void {
  registry = new Map();
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
 * **IMPORTANT — Premultiplied alpha (conventions §2):**
 * Your fragment shader MUST output premultiplied alpha:
 *   `outColor = vec4(rgb * a, a);`  ← correct
 *   `outColor = vec4(rgb, a);`      ← WRONG — over-brightens translucent regions
 *
 * The renderer uses `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` to match.
 * Opaque fragments (a=1) are unaffected; only fragments with a < 1 differ.
 *
 * **Re-registration behavior:**
 * - Dev mode (`NODE_ENV !== 'production'`): calling with an existing id replaces
 *   the source (hot-reload). Each renderer must call `WeaselRenderer.registerProgram(handle)`
 *   again to pick up the new source.
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
    throw new Error(`weasel-gl registerProgram: duplicate program id "${id}". ` +
      `In production, re-registration is not allowed. Pass a unique id or call in dev mode.`);
  }
  registry.set(id, { vert, frag });
  return { id };
}
