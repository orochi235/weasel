import { type SceneCanvasApi, useLatest } from '@weasel-js/core';
import { useCallback, useEffect, useInsertionEffect, useRef } from 'react';
import type { useSurfaceOptional } from '../surface/useSurfaceTile';

/** The pane's hold on its `<SceneCanvas>`: the ref callback that attaches it, and a stable way to ask it to
 *  repaint. */
export interface OverlayCanvas {
  attach: (api: SceneCanvasApi | null) => void;
  redraw: () => void;
}

/**
 * Hold the pane's `<SceneCanvas>` and keep the lab's shared buffer clean under it.
 *
 * Erases the whole shared buffer when the tiles move: a tile that moved took
 * its scissor with it, and what it painted last frame stays where it was.
 * Each renderer on the context re-applies its viewport and scissor per frame,
 * so resetting them here is safe.
 * Only once this pane has painted: a bare `getContext` on a buffer no
 * renderer has opened creates the context without the stencil buffer marks
 * need, and every later request gets that context back.
 */
export function useOverlayCanvas(
  surface: ReturnType<typeof useSurfaceOptional>,
  tileId: string,
  canvas: HTMLCanvasElement | null,
): OverlayCanvas {
  const sceneCanvas = useRef<SceneCanvasApi | null>(null);
  const painted = useRef(false);
  const canvasRef = useLatest(canvas);
  // A new buffer has not been painted into, whatever the old one had. Reset
  // with the commit that brings it, ahead of any paint that commit triggers.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `canvas` is the signal, not a value this reads
  useInsertionEffect(() => {
    painted.current = false;
  }, [canvas]);
  const unsubscribeFrame = useRef<(() => void) | null>(null);
  const attach = useCallback((api: SceneCanvasApi | null) => {
    sceneCanvas.current = api;
    unsubscribeFrame.current?.();
    unsubscribeFrame.current = api
      ? api.subscribeFrame(() => {
          painted.current = true;
        })
      : null;
  }, []);
  useEffect(() => {
    if (!surface) return;
    return surface.registerClear(tileId, (size, dpr) => {
      if (!painted.current) return;
      const gl = canvasRef.current?.getContext('webgl2');
      if (!gl) return;
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, Math.round(size.width * dpr), Math.round(size.height * dpr));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    });
  }, [canvasRef, surface, tileId]);
  const redraw = useCallback(() => sceneCanvas.current?.requestRedraw(), []);
  return { attach, redraw };
}
