/**
 * `useColorAtDepSource` — wires the `colorAt` dep the eyedropper samples
 * through. It answers exactly: the layers it is given are drawn again,
 * offscreen, into the device pixels around the point at the canvas's current
 * view and pixel ratio, and the middle one is read. Chrome, overlays and
 * ambient contributions the canvas paints over them never reach the answer.
 */
import { useEffect, useState } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { ColorAtDep } from 'interactions/actions/depSchema';
import { createLayerSampler } from '../layerSample';

/** What the dep reads at each sample: the layers and how the canvas draws them now. */
export interface ColorAtSource {
  /** The layers sampled, bottom first. */
  layers: () => readonly RenderLayer<unknown>[];
  view: () => View;
  /** The canvas's CSS size and its device pixels to the CSS pixel; null before it mounts. */
  dims: () => { width: number; height: number; dpr: number } | null;
  /** What the canvas hands its layers as `data`. */
  data?: () => unknown;
}

export function useColorAtDepSource(source: ColorAtSource): void {
  const [sampler] = useState(createLayerSampler);
  useEffect(() => () => sampler.dispose(), [sampler]);
  const latest = useLatest(source);
  useDepSource('colorAt', (): ColorAtDep => (point) => {
    const s = latest.current;
    const dims = s.dims();
    if (!dims) return null;
    return sampler.sample({ layers: s.layers(), data: s.data?.(), view: s.view(), dims, point });
  });
}
