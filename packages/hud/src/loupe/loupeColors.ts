/** What color a loupe is over: the source layers redrawn exactly where it can, the framebuffer elsewhere. */
import { createLayerSampler, type RenderLayer } from '@weasel-js/core';
import { createSampler, type LoupePoint } from '@weasel-js/loupe';
import { rgbaHex } from '@weasel-js/paint';
import type { HudContentCtx } from '../widget';

/** Where {@link createLoupeColors} reads. */
export interface LoupeColorSources {
  /** The framebuffer's RGBA at a point, premultiplied as a WebGL readback is. */
  pixel: (at: LoupePoint) => ArrayLike<number> | null;
  /** The layers to sample exactly now, or null where only the framebuffer can say. */
  layers: () => readonly RenderLayer<unknown>[] | null;
}

type Frame = Pick<HudContentCtx, 'data' | 'view' | 'dims'>;

/**
 * The color under a point. Given layers, it redraws them at the point in the
 * frame the lens last drew in — the canvas's view and pixel ratio — so chrome
 * painted over them never answers. It reads the framebuffer where they cannot:
 * before any frame, or with no WebGL2 to redraw with.
 */
export function createLoupeColors(sources: LoupeColorSources) {
  const framebuffer = createSampler([{ premultiplied: true, pixel: sources.pixel }]);
  const exact = createLayerSampler();
  let drawnIn: Frame | null = null;
  return {
    /** The lens drew in this frame. */
    drew(frame: Frame) {
      drawnIn = frame;
    },
    sample(at: LoupePoint): string | null {
      const layers = sources.layers();
      const px = layers && drawnIn
        ? exact.rgba({ layers, data: drawnIn.data, view: drawnIn.view, dims: drawnIn.dims, point: at })
        : null;
      return px ? rgbaHex(px) : (framebuffer.sample(at) as string | null);
    },
    dispose() {
      exact.dispose();
    },
  };
}
