import { useCallback, useEffect, useState, type RefObject } from 'react';
import { hostAnchorStyle, type HostAnchorOffset } from './hostAnchor';

/**
 * Track a fixed-position panel's `top`/`right` against the canvas's host box,
 * kept inside the viewport.
 *
 * Put the returned `ref` on the panel. Before it has been measured the panel is
 * treated as zero-sized, which resolves to the plain top-right corner — so the
 * first paint lands where an unclamped anchor would, and measurement only ever
 * pulls it back on screen.
 */
export function useHostAnchor(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  offset: HostAnchorOffset,
  padding = 0,
): { ref: (el: HTMLElement | null) => void; style: { top: number; right: number } | null } {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [style, setStyle] = useState<{ top: number; right: number } | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setPanel(el), []);
  const { top, right } = offset;

  useEffect(() => {
    const recompute = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setStyle(null);
        return;
      }
      // The anchor is the canvas's container — WeaselDraw's workspace — falling
      // back to the canvas when nothing wraps it.
      const hostEl = canvas.parentElement ?? canvas;
      const h = hostEl.getBoundingClientRect();
      const p = panel?.getBoundingClientRect();
      setStyle(hostAnchorStyle({
        host: { x: h.left, y: h.top, width: h.width, height: h.height },
        panel: { width: p?.width ?? 0, height: p?.height ?? 0 },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        offset: { top, right },
        padding,
      }));
    };

    recompute();
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recompute) : null;
    if (panel) observer?.observe(panel);
    const hostEl = canvasRef.current?.parentElement ?? canvasRef.current;
    if (hostEl) observer?.observe(hostEl);
    return () => {
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
      observer?.disconnect();
    };
  }, [canvasRef, panel, top, right, padding]);

  return { ref, style };
}
