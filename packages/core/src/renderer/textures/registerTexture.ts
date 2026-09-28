/**
 * registerTexture — accepts an image source, assigns an opaque id, stores in
 * a module-level registry. Actual GL upload happens lazily at draw time in
 * drawShader() via GLTextureCache.upload (which is idempotent).
 *
 * Lifecycle: textures live for the renderer's lifetime. No unregister in v1.
 *
 * Convention §9: this registry stores image data only — no per-renderer state.
 * Each WeaselRenderer's GLTextureCache does its own dedup via has(id).
 */

import type { TextureHandle } from '@weasel-js/paint';
import { createReflectable, type Reflection } from '@weasel-js/registry';

export type { TextureHandle };

/** A registered texture's image source, uploaded to GL lazily at first draw. */
export interface TextureEntry {
  source: HTMLImageElement | ImageBitmap;
}

let counter = 0;
const registry = createReflectable<TextureEntry>();

/** Every registered texture, keyed by its handle id. */
export const textureRegistry: Reflection<TextureEntry> = registry.reflection;

/** @internal Test helper — do not call from product code. */
export function _resetTextureRegistryForTests(): void {
  registry.clear();
  counter = 0;
}

export function getTexture(id: string): TextureEntry | null {
  return registry.get(id) ?? null;
}

/**
 * Register an image for use as a shader texture uniform.
 *
 * Returns a TextureHandle whose `id` can be passed as a ShaderUniform value.
 * The handle is valid for the lifetime of the renderer it will be used with.
 *
 * @param image  The image to register. HTMLImageElement must be fully loaded.
 * @returns      Opaque TextureHandle.
 */
export function registerTexture(
  image: HTMLImageElement | ImageBitmap,
): TextureHandle {
  const id = `tex_${++counter}`;
  registry.set(id, { source: image });
  return { id };
}
