import { useVisibleRaf } from '@weasel-js/core';
import type { LoupeMode, LoupePoint } from '@weasel-js/loupe';
import { useEffect, useRef } from 'react';
import type { CanvasStackSurface } from '../canvas/CanvasStackContext';
import type { WorldFrame, WorldSpec } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';
import { drawCanvasLens } from './canvasLens';

/** Props for `<CanvasLoupe>`. */
export interface CanvasLoupeProps {
  aim: LoupePoint;
  factor: number;
  mode: LoupeMode;
  diameter: number;
  /** The stack being magnified: its layers, its pixels, and its measured box. */
  surface: CanvasStackSurface;
  view: ViewTransform;
  frame: WorldFrame;
  worldSpec?: WorldSpec;
}

/**
 * Paints a lens over a `<CanvasStack>` by re-drawing the stack's layers through
 * a zoomed camera — so the magnified content is as sharp as the original, at
 * any factor. `pixel` mode enlarges what the stack presented instead.
 */
export function CanvasLoupe({
  aim,
  factor,
  mode,
  diameter,
  surface,
  view,
  frame,
  worldSpec,
}: CanvasLoupeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = surface.size.dpr;

  // Whatever the stack redraws every frame, the lens has to redraw too — an
  // instrument that animates from its own loop never re-renders this component.
  const args = { aim, factor, mode, diameter, dpr, view, frame, worldSpec, surface };
  const argsRef = useRef(args);
  argsRef.current = args;

  const loop = useVisibleRaf(
    () => {
      loop.request();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const canvases = argsRef.current.surface.canvases.current;
      if (!ctx || !canvases) return;
      const a = argsRef.current;
      drawCanvasLens(ctx, {
        aim: a.aim,
        factor: a.factor,
        diameter: a.diameter,
        dpr: a.dpr,
        mode: a.mode,
        outer: a.view,
        outerFrame: a.frame,
        worldSpec: a.worldSpec,
        layers: a.surface.layers,
        canvases,
      });
    },
    { target: canvasRef },
  );

  useEffect(() => {
    loop.request();
    return () => loop.cancel();
  }, [loop]);

  return (
    <canvas
      ref={canvasRef}
      className="lk-loupe__canvas"
      width={Math.max(1, Math.round(diameter * dpr))}
      height={Math.max(1, Math.round(diameter * dpr))}
    />
  );
}
