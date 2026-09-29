import { useEffect } from 'react';
import { subscribeGlyphReady } from '@weasel-js/font';
import { subscribeImageReady } from 'features/images/imageCache';
import { paintKindRegistry } from 'core/paintKinds';

/**
 * Repaint whenever something a frame could not draw becomes drawable: an image
 * finishes decoding, a deferred glyph bake or font load lands, or a paint kind
 * registers late. Each of these drew nothing (or a placeholder) on the frame
 * that asked for it and says nothing further unless a surface is listening.
 */
export function useLateContentRedraw(requestRedraw: () => void): void {
  useEffect(() => {
    const offs = [
      subscribeImageReady(requestRedraw),
      subscribeGlyphReady(requestRedraw),
      paintKindRegistry.subscribe(requestRedraw),
    ];
    return () => { for (const off of offs) off(); };
  }, [requestRedraw]);
}
