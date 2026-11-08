import { useEffect, useRef } from 'react';
import { fitZoom } from './fitToBounds';

/**
 * Compute zoom and pan that fit `contentW x contentH` (in content units)
 * inside `viewportW x viewportH` (in pixels). `padRatio` is the fraction of
 * each axis to fill (default 0.85 — leaves a uniform 15% margin). `null` when
 * there is nothing to fit, as `fitZoom`.
 */
export function computeFitViewport(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  padRatio = 0.85,
): { zoom: number; panX: number; panY: number } | null {
  const zoom = fitZoom(viewportW * padRatio, viewportH * padRatio, contentW, contentH);
  if (zoom === null) return null;
  const cw = Math.max(0, contentW) * zoom;
  const ch = Math.max(0, contentH) * zoom;
  return { zoom, panX: (viewportW - cw) / 2, panY: (viewportH - ch) / 2 };
}

/**
 * Run `computeFitViewport` once the viewport has non-zero size and there is
 * content to fit, and apply the result via the supplied setters. Until then
 * the view stays the initial one the caller set up. Later changes are
 * ignored — this hook centers exactly once.
 */
export function useAutoCenter(
  width: number,
  height: number,
  contentW: number,
  contentH: number,
  setZoom: (z: number) => void,
  setPan: (x: number, y: number) => void,
) {
  const hasCentered = useRef(false);

  useEffect(() => {
    if (width > 0 && height > 0 && !hasCentered.current) {
      const fit = computeFitViewport(width, height, contentW, contentH);
      if (fit === null) return;
      hasCentered.current = true;
      setZoom(fit.zoom);
      setPan(fit.panX, fit.panY);
    }
  }, [width, height, contentW, contentH, setZoom, setPan]);
}
