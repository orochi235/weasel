import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { paintedLayers, type LayerDrawSpan, type RenderLayer } from 'core/layers/render';
import type { CanvasDebugSink, DebugFlags } from './types';
import { resolveDebugFlags } from './parseDebugFlags';
import { createDebugSink } from './createDebugSink';
import { createDebugOverlayLayer, DEBUG_OVERLAY_ID } from './createDebugOverlayLayer';
import { frameStatsOf, type TimedRun } from './frameStats';

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
 * `highlight` is left out of the key: an inspector changes it on every hover,
 * so it is written into the live config, and only the overlay is replaced.
 */
export function useDebugSink(debug: DebugFlags | false | undefined): SurfaceDebug {
  const { highlight, ...rest }: DebugFlags = debug || {};
  const key = debug === undefined ? undefined : debug === false ? 'false' : JSON.stringify(rest);
  const highlightKey = JSON.stringify(highlight ?? null);
  const base = useMemo(() => {
    const config = resolveDebugFlags(key === undefined ? undefined : JSON.parse(key) as DebugFlags | false);
    if (!config) return null;
    const live: DebugFlags = { ...config };
    const setHighlight = (ids: readonly string[] | null): void => {
      if (ids) live.highlight = ids;
      else delete live.highlight;
    };
    const sink = createDebugSink(live);
    return { setHighlight, sink, overlay: createDebugOverlayLayer({ sink, config: live }), frameStats: config.fps === true };
  }, [key]);
  // In commit, not render: `live` is shared, and a render React throws away must not leave its highlight there.
  useLayoutEffect(() => { base?.setHighlight(JSON.parse(highlightKey) as string[] | null); }, [base, highlightKey]);
  const state = useMemo(() => {
    if (!base) return OFF;
    return { sink: base.sink, overlay: { ...base.overlay }, frameStats: base.frameStats };
    // A new overlay object per highlight, so the stack recomposes and repaints.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, highlightKey]);
  const committed = useLatest(state.sink);
  const getDebug = useCallback(() => committed.current, [committed]);
  return { ...state, getDebug };
}

/** One paint's recording, from {@link beginDebugFrame}. */
export interface DebugFrame {
  /** Start the paint clock. Returns the list `drawLayers` fills, or
   *  `undefined` when the frame panel is off and nothing is timed. */
  time(): LayerDrawSpan[] | undefined;
  /** Record what the timed paint cost, one run per renderer it went
   *  through, bottom first. A no-op unless `time` was called. */
  end(runs: readonly TimedRun[]): void;
}

/**
 * Open a paint's recording: clear the sink's per-frame records and note the
 * stack about to be drawn, bottom first: the layers `visibility` and `order`
 * leave painted, as `drawLayers` reads them. Returns `null` with no sink.
 */
export function beginDebugFrame(
  sink: CanvasDebugSink | null,
  frameStats: boolean,
  layers: readonly RenderLayer<unknown>[],
  visibility: Record<string, boolean>,
  order: readonly string[] | undefined,
): DebugFrame | null {
  if (!sink) return null;
  sink.beginFrame();
  const painted = paintedLayers(layers, visibility, order);
  for (let i = 0; i < painted.length; i++) {
    const layer = painted[i]!;
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
    end: (runs) => {
      if (spans) sink.recordFrame(frameStatsOf(runs, performance.now() - startedAt));
    },
  };
}
