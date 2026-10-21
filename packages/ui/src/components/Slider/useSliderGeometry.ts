import { useMemo, useState } from 'react';
import { lineShape, trackRun, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { curvedGeometry, lineGeometry, type SliderGeometry } from './sliderGeometry';
import { fractionToPosition } from './stops';
import type { TrackCtx } from './types';
import type { Box } from './useBoxes';

/** What picks a slider's geometry: the shape it lies along, how its thumbs fit the ends, and the elements it measures. */
export interface SliderGeometryArgs {
  shape: TrackShape | undefined;
  thumbFit: 'inside' | 'overhang';
  /** The first thumb's untransformed width in px. */
  thumbLength: number;
  rail: () => HTMLElement | null;
  root: () => HTMLElement | null;
  band: () => SVGElement | null;
}

/** The slider's geometry, one identity per shape, fit and thumb length, and on a curve the value span it runs over. */
export function useSliderGeometry(args: SliderGeometryArgs): { geometry: SliderGeometry; run: TrackRun | null } {
  const { shape, thumbFit, thumbLength } = args;
  const [els] = useState(() => ({ rail: args.rail, root: args.root, band: args.band }));
  const [line] = useState(() => lineGeometry(els.rail));
  const curve = shape && shape.kind !== 'line' ? shape : undefined;
  const run = useMemo(() => {
    if (!curve) return null;
    if (thumbFit === 'overhang') return trackRun(curve);
    // Capped at the middle, so an arc shorter than a thumb collapses there instead of inverting.
    const i = Math.min(0.5, thumbLength / 2 / curve.length);
    return trackRun(curve, i, 1 - i);
  }, [curve, thumbFit, thumbLength]);
  const geometry = useMemo(() => (run ? curvedGeometry(run, els.root, els.band) : line), [run, els, line]);
  return { geometry, run };
}

/** What a track painter is handed. On a line the span runs along the rail, centered in the painted layer. */
export function trackCtxOf(run: TrackRun | null, track: Box | undefined, layer: Box | undefined, rail: Box | undefined, valueToFraction: (v: number) => number): TrackCtx {
  if (run) return { shape: run, trackWidth: run.length, valueToFraction, fractionToPosition };
  const w = layer?.width ?? 0;
  const h = layer?.height ?? 0;
  const railW = rail?.width ?? 0;
  const i = (w - railW) / 2;
  const shape = trackRun(lineShape({ x: i, y: h / 2 }, { x: i + railW, y: h / 2 }));
  return { shape, trackWidth: track?.width ?? 0, valueToFraction, fractionToPosition };
}
