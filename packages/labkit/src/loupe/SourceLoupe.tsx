import { useLatest, useVisibleRaf } from '@weasel-js/core';
import { type LoupePoint, type LoupeSize, loupeExtent } from '@weasel-js/loupe';
import { type RefObject, useEffect, useRef } from 'react';
import { drawSourceLens, type LoupeSource, resolveLoupeSource, sourceBoxIn } from './sourceLens';

/** Props for `<SourceLoupe>`. */
export interface SourceLoupeProps {
  aim: LoupePoint;
  factor: number;
  /** One number for a round or square lens, or a width and a height. */
  diameter: LoupeSize;
  /** The canvas whose pixels the lens enlarges. */
  source: LoupeSource;
  /** The element `aim` is measured in, which the source's box is found against. */
  hostRef: RefObject<HTMLElement | null>;
}

/**
 * Paints a pixel lens from any canvas — one labkit drew or one it has never
 * seen, 2D or WebGL. It redraws every frame, since the canvas it reads moves
 * on its own schedule.
 */
export function SourceLoupe({ aim, factor, diameter, source, hostRef }: SourceLoupeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const argsRef = useLatest({ aim, factor, diameter, dpr, source });

  const loop = useVisibleRaf(
    () => {
      loop.request();
      const ctx = canvasRef.current?.getContext('2d');
      const a = argsRef.current;
      const src = resolveLoupeSource(a.source);
      if (!ctx || !src) return;
      drawSourceLens(ctx, {
        aim: a.aim,
        factor: a.factor,
        diameter: a.diameter,
        dpr: a.dpr,
        source: src,
        box: sourceBoxIn(src, hostRef.current),
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
      width={Math.max(1, Math.round(loupeExtent(diameter).width * dpr))}
      height={Math.max(1, Math.round(loupeExtent(diameter).height * dpr))}
    />
  );
}
