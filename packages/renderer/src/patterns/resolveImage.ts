/**
 * `ImagePatternPaint` → `TextureHandle`. The handle's id is the paint's `src`,
 * so it is minted synchronously before the image has decoded, and a painter
 * memoizing its commands can hold it from the first frame. The texture behind
 * it is whatever `imageCache` holds for that `src` at draw time: absent while
 * it loads, which draws nothing, and re-registered whenever the cache swaps or
 * drops its bitmap.
 */

import type { ImagePatternPaint } from '@weasel-js/paint';
import { getImageBitmap, imageNaturalSize } from '../images/imageCache';
import {
  ownTextureIds, registerTextureAs, textureRegistry, unregisterTexture,
  type TextureHandle,
} from '../textures/registerTexture';

const ID_PREFIX = 'image:';

/** The texture that draws `paint`'s picture. Never `null`: an image that has
 *  not decoded yet, or failed to, has a handle that draws nothing. */
export function resolveImagePattern(paint: Pick<ImagePatternPaint, 'src'>): TextureHandle {
  return { id: ID_PREFIX + paint.src };
}

/** Keep the registry entry for `id` the bitmap the image cache holds now. The
 *  cache owns that bitmap and closes it when it drops it, so an entry left
 *  pointing at the old one would upload a closed bitmap. */
function sync(id: string): void {
  const src = id.slice(ID_PREFIX.length);
  const bitmap = getImageBitmap(src);
  const held = textureRegistry.get(id)?.source;
  if (bitmap === held) return;
  // An image node drawing the same SVG re-rasterizes it to its own size; the
  // tile a paint with no extent repeats at stays the picture's natural size.
  if (bitmap) registerTextureAs(id, bitmap, imageNaturalSize(src));
  else unregisterTexture({ id });
}

ownTextureIds(ID_PREFIX, { revive: sync, touched: sync });
