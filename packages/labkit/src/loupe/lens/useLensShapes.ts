import { FALLBACK_ACCENT, registerNodeShape } from '@weasel-js/core';
import { useCallback, useEffect, useState } from 'react';
import { type ThemeColorSpec, useThemeColors } from '../../canvas/useThemeColors';
import { type LensColors, lensShapes } from './lensShapes';
import type { LensScene } from './lensTypes';

const LENS_COLORS: ThemeColorSpec<keyof LensColors> = {
  rim: ['--wzl-accent', FALLBACK_ACCENT],
  reticle: ['--wzl-fg', '#ffffff'],
};

/** A ref callback for the lens layer: it sets the layer and registers the lens shapes in the theme read from it,
 *  again whenever that theme changes, so the lenses take the theme the lab is in. */
export function useLensShapes<C>(
  scene: LensScene<C>,
  redraw: () => void,
  setLayer: (el: HTMLDivElement | null) => void,
) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const colors = useThemeColors(el, LENS_COLORS);
  useEffect(() => {
    if (!colors) return;
    const off = lensShapes(colors, scene).map((s) => registerNodeShape(s, { priority: 'high' }));
    redraw();
    return () => {
      for (const u of off) u();
    };
  }, [colors, scene, redraw]);
  return useCallback(
    (node: HTMLDivElement | null) => {
      setLayer(node);
      setEl(node);
    },
    [setLayer],
  );
}
