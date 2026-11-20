import type { LayerDrawSpan } from 'core/layers/render';
import type { RenderStats } from '@weasel-js/renderer';
import type { FrameStats } from './types';

/** What one renderer drew of a paint: the spans `drawLayers` filled for its commands, and its stats. */
export interface TimedRun {
  spans: readonly LayerDrawSpan[];
  render: RenderStats;
}

/** One paint's {@link FrameStats}: each layer's build time from `drawLayers`
 *  joined with its dispatch cost from the renderer, span for span, across
 *  every renderer the paint went through, bottom first. */
export function frameStatsOf(runs: readonly TimedRun[], paintMs: number): FrameStats {
  let drawCalls = 0;
  const layers: FrameStats['layers'] = [];
  for (const { spans, render } of runs) {
    drawCalls += render.drawCalls;
    spans.forEach((l, i) => {
      layers.push({ id: l.id, drawCalls: render.spans[i]?.drawCalls ?? 0, ms: l.buildMs + (render.spans[i]?.ms ?? 0) });
    });
  }
  return { paintMs, drawCalls, layers };
}
