import { registerNodeShape } from '@weasel-js/core';
import { useCallback, useEffect, useState } from 'react';
import { type LensColors, lensShapes } from './lensShapes';
import type { LensScene } from './lensTypes';

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/** A ref callback for the lens layer: it sets the layer and registers the lens shapes in the theme read from it, once,
 *  so the lenses take the theme the lab is in. */
export function useLensShapes<C>(
  scene: LensScene<C>,
  redraw: () => void,
  setLayer: (el: HTMLDivElement | null) => void,
) {
  const [colors, setColors] = useState<LensColors | null>(null);
  useEffect(() => {
    if (!colors) return;
    const off = lensShapes(colors, scene).map((s) => registerNodeShape(s, { priority: 'high' }));
    redraw();
    return () => {
      for (const u of off) u();
    };
  }, [colors, scene, redraw]);
  return useCallback(
    (el: HTMLDivElement | null) => {
      setLayer(el);
      if (el)
        setColors({
          rim: cssVar(el, '--wzl-accent', '#4c8dff'),
          reticle: cssVar(el, '--wzl-fg', '#ffffff'),
        });
    },
    [setLayer],
  );
}
