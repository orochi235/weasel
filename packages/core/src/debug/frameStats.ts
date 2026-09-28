import type { LayerDrawSpan } from 'core/layers/render';
import type { RenderStats } from '../renderer/WeaselRenderer';
import type { FrameStats } from './types';

/** One paint's {@link FrameStats}: each layer's build time from `drawLayers`
 *  joined with its dispatch cost from the renderer, span for span. */
export function frameStatsOf(layers: readonly LayerDrawSpan[], render: RenderStats, paintMs: number): FrameStats {
  return {
    paintMs,
    drawCalls: render.drawCalls,
    layers: layers.map((l, i) => ({
      id: l.id,
      drawCalls: render.spans[i]?.drawCalls ?? 0,
      ms: l.buildMs + (render.spans[i]?.ms ?? 0),
    })),
  };
}
