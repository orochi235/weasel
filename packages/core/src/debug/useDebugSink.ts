import { useCallback, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { RenderStats } from '@weasel-js/renderer';
import type { LayerDrawSpan, RenderLayer } from 'core/layers/render';
import type { CanvasDebugSink, DebugConfig } from './types';
import { parseDebugFlags } from './parseDebugFlags';
import { createDebugSink } from './createDebugSink';
import { createDebugOverlayLayer, DEBUG_OVERLAY_ID } from './createDebugOverlayLayer';
import { frameStatsOf } from './frameStats';

/** A surface's debug state for one resolved config. */
export interface SurfaceDebug {
  /** Null when debugging is off. */
  sink: CanvasDebugSink | null;
  /** The layer that paints the sink, for the top of the surface's stack. */
  overlay: RenderLayer<unknown> | null;
  /** Whether a paint should time itself for the frame panel. */
  frameStats: boolean;
  /** The sink of the last committed render. Stable. */
  getDebug: () => CanvasDebugSink | null;
}

const OFF = { sink: null, overlay: null, frameStats: false };

/**
 * Resolve a surface's `debug` prop and hold what it turns on. `undefined`
 * reads `?debug=…` from the URL, `false` forces it off, and a config forces it
 * on. Keyed on the config's content, so one written inline keeps its sink, and
 * what the sink and the overlay have accumulated, from render to render.
 */
export function useDebugSink(debug: DebugConfig | false | undefined): SurfaceDebug {
  const key = debug === undefined ? undefined : JSON.stringify(debug);
  const state = useMemo(() => {
    const config = key !== undefined
      ? (JSON.parse(key) as DebugConfig | false) || null
      : typeof window === 'undefined' ? null : parseDebugFlags(window.location.search);
    if (!config) return OFF;
    const sink = createDebugSink(config);
    return { sink, overlay: createDebugOverlayLayer({ sink, config }), frameStats: config.fps === true };
  }, [key]);
  const committed = useLatest(state.sink);
  const getDebug = useCallback(() => committed.current, [committed]);
  return { ...state, getDebug };
}

/** One paint's recording, from {@link beginDebugFrame}. */
export interface DebugFrame {
  /** Start the paint clock. Returns the list `drawLayers` fills, or
   *  `undefined` when the frame panel is off and nothing is timed. */
  time(): LayerDrawSpan[] | undefined;
  /** Record what the timed paint cost. A no-op unless `time` was called. */
  end(render: RenderStats): void;
}

/**
 * Open a paint's recording: clear the sink's per-frame records and note the
 * stack about to be drawn, bottom first. Returns `null` with no sink.
 */
export function beginDebugFrame(
  sink: CanvasDebugSink | null,
  frameStats: boolean,
  layers: readonly RenderLayer<unknown>[],
): DebugFrame | null {
  if (!sink) return null;
  sink.beginFrame();
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]!;
    if (layer.id === DEBUG_OVERLAY_ID) continue;
    sink.recordLayer(layer.id, layer.label, layer.space ?? 'world', i);
  }
  let spans: LayerDrawSpan[] | undefined;
  let startedAt = 0;
  return {
    time: () => {
      if (!frameStats) return undefined;
      spans = [];
      startedAt = performance.now();
      return spans;
    },
    end: (render) => {
      if (spans) sink.recordFrame(frameStatsOf(spans, render, performance.now() - startedAt));
    },
  };
}
