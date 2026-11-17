import { useEffect, useRef } from 'react';
import { fitSize } from './fitSize';

const AUTO_CENTER_FILL = 0.85;

/**
 * Fit and center the content with `fitSize` once the viewport has non-zero size and there is
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
      const fit = fitSize(width, height, contentW, contentH, 0, undefined, AUTO_CENTER_FILL);
      if (fit === null) return;
      hasCentered.current = true;
      setZoom(fit.zoom);
      setPan(fit.panX, fit.panY);
    }
  }, [width, height, contentW, contentH, setZoom, setPan]);
}
