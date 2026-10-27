/**
 * A module-level registry of image sources by opaque id. It stores image data
 * only — no per-renderer state; each renderer uploads to GL lazily at draw
 * time. A texture lives until `unregisterTexture`.
 */

import type { TextureHandle } from '@weasel-js/paint';
import { createReflectable, type Reflection } from '@weasel-js/registry';

export type { TextureHandle };

/** A registered texture's image source, uploaded to GL lazily at first draw. */
export interface TextureEntry {
  source: HTMLImageElement | ImageBitmap;
  /** The size the texture stands for, when `source` is a resampling of a
   *  picture whose raster can change size (a re-rasterized SVG). */
  size?: { width: number; height: number };
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

/**
 * Whoever mints the ids under one prefix and can rebuild any of them.
 * @internal
 */
export interface TextureIdOwner {
  /** Register `id` again if it can be rebuilt; do nothing otherwise. */
  revive(id: string): void;
  /** `id` was looked up and found: something is about to draw it. The
   *  owner may replace or drop the entry here; the lookup reads it after. */
  touched?(id: string): void;
}

const owners: { prefix: string; owner: TextureIdOwner }[] = [];

/**
 * Claim every texture id starting with `prefix`. Returns the release.
 * @internal
 */
export function ownTextureIds(prefix: string, owner: TextureIdOwner): () => void {
  const claim = { prefix, owner };
  owners.push(claim);
  return () => {
    const i = owners.indexOf(claim);
    if (i !== -1) owners.splice(i, 1);
  };
}

/**
 * Whether an owner claims `id`. A lookup of an owned id that misses is the
 * owner's business — a texture still loading, say — rather than a stale
 * handle worth a warning.
 * @internal
 */
export function isOwnedTextureId(id: string): boolean {
  return ownerOf(id) !== undefined;
}

function ownerOf(id: string): TextureIdOwner | undefined {
  for (let i = 0; i < owners.length; i++) {
    if (id.startsWith(owners[i].prefix)) return owners[i].owner;
  }
  return undefined;
}

/**
 * The entry for `id`, as a draw looks it up. An owned id that was
 * unregistered is rebuilt by its owner first, so a handle held past its
 * texture's eviction still draws.
 */
export function getTexture(id: string): TextureEntry | null {
  const owner = owners.length > 0 ? ownerOf(id) : undefined;
  const hit = registry.get(id);
  if (hit) {
    if (!owner?.touched) return hit;
    owner.touched(id);
    return registry.get(id) ?? null;
  }
  if (!owner) return null;
  owner.revive(id);
  return registry.get(id) ?? null;
}

/**
 * Register an image for use as a shader texture uniform. Returns a
 * TextureHandle whose `id` can be passed as a ShaderUniform value.
 *
 * The texture holds premultiplied texels whichever source it came from, so a
 * shader sampling one reads `vec4(rgb * a, a)`, the form its own output takes.
 *
 * @param image  HTMLImageElement must be fully loaded. An ImageBitmap must
 *               hold premultiplied pixels, the `createImageBitmap` default.
 */
export function registerTexture(
  image: HTMLImageElement | ImageBitmap,
): TextureHandle {
  const id = `tex_${++counter}`;
  registry.set(id, { source: image });
  return { id };
}

/**
 * Register an image under an id its caller chose.
 * @internal
 */
export function registerTextureAs(
  id: string,
  image: HTMLImageElement | ImageBitmap,
  size?: TextureEntry['size'],
): TextureHandle {
  registry.set(id, size ? { source: image, size } : { source: image });
  return { id };
}

/**
 * Drop a registered texture. Every renderer that uploaded it frees its GL
 * copy at the top of its next frame; a draw command still holding the handle
 * then draws nothing and warns. The image itself is the caller's to release.
 *
 * @returns Whether the handle was registered.
 */
export function unregisterTexture(handle: TextureHandle): boolean {
  return registry.delete(handle.id);
}
