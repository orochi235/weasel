/**
 * FontRegistry and registerFont() public API.
 *
 * registerFont(family, metricsUrl, atlasUrl) is async: fetches JSON metrics
 * + PNG atlas and stores both in the module-level registry. At render time
 * WeaselRenderer calls ensureFontTexture() to lazily upload the atlas
 * ImageBitmap to GL — keeps registerFont GL-context-agnostic.
 *
 * CJK coverage: deferred. The default Inter atlas covers ASCII + Latin-1.
 * Extending coverage requires generating a larger atlas and calling
 * registerFont with the extended metrics + PNG.
 */

import { parseBmFont, type BmFont } from './FontAtlas';
import type { GLTextureCache } from '../../../renderer/cache/GLTextureCache';

export interface FontEntry {
  font: BmFont;
  bitmap: ImageBitmap;
}

let registry = new Map<string, FontEntry>();

/** Test helper. Do not call from product code. */
export function _resetFontRegistryForTests(): void {
  registry = new Map();
}

export function getFont(family: string): FontEntry | null {
  return registry.get(family) ?? null;
}

export async function registerFont(
  family: string,
  metricsUrl: string,
  atlasUrl: string,
): Promise<void> {
  if (registry.has(family)) return;

  try {
    const [metricsRes, atlasRes] = await Promise.all([
      fetch(metricsUrl),
      fetch(atlasUrl),
    ]);

    if (!metricsRes.ok) {
      throw new Error(`HTTP ${metricsRes.status} fetching metrics from ${metricsUrl}`);
    }
    if (!atlasRes.ok) {
      throw new Error(`HTTP ${atlasRes.status} fetching atlas from ${atlasUrl}`);
    }

    const [rawJson, blob] = await Promise.all([
      metricsRes.json(),
      atlasRes.blob(),
    ]);

    const font = parseBmFont(rawJson);
    const bitmap = await createImageBitmap(blob);

    registry.set(family, { font, bitmap });
  } catch (err) {
    throw new Error(
      `weasel registerFont("${family}"): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Ensure the font's atlas is uploaded to `textureCache`. The cache's own
 * `has()` check handles dedup — multiple renderers each have their own
 * textureCache, so we can't rely on a per-font flag. `upload` is a no-op
 * if the texture is already present.
 */
export function ensureFontTexture(
  family: string,
  textureCache: GLTextureCache,
): boolean {
  const entry = registry.get(family);
  if (!entry) return false;
  textureCache.upload(family, entry.bitmap);
  return true;
}

/** Kept as a no-op for context-restore call sites; per-cache dedup handles it now. */
export function _markAllFontsNotUploaded(): void {}
