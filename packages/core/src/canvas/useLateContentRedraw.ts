import { useEffect } from 'react';
import { subscribeGlyphReady } from '@weasel-js/font';
import { subscribeImageReady } from '@weasel-js/renderer';
import { paintKindRegistry } from 'core/paint/paintKinds';
import { subscribeNodeShapes } from './NodeShape';

/**
 * Repaint whenever something a frame could not draw becomes drawable: an image
 * finishes decoding, a deferred glyph bake or font load lands, a paint kind
 * registers late, or the node shape set changes. Each of these drew nothing (or
 * a placeholder, or the old painter) on the frame that asked for it and says
 * nothing further unless a surface is listening.
 */
export function useLateContentRedraw(requestRedraw: () => void): void {
  useEffect(() => {
    const offs = [
      subscribeImageReady(requestRedraw),
      subscribeGlyphReady(requestRedraw),
      paintKindRegistry.subscribe(requestRedraw),
      subscribeNodeShapes(requestRedraw),
    ];
    return () => { for (const off of offs) off(); };
  }, [requestRedraw]);
}
