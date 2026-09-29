/**
 * `<DrawCanvas>` — a sized, DPR-correct WebGL2 surface that paints a list of
 * draw commands, with no scene, tools or dispatcher behind it.
 *
 * It paints through the same per-canvas renderer as `<SceneViewCanvas>`
 * (`paintCanvas`), on a `useFrameLoop` that stops while the canvas is off
 * screen or the tab is hidden. Like `<SceneViewCanvas>` it attaches no event
 * listeners and emits no inline styles: size the element with `className`.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { Ref } from 'react';
import { useLatest } from '@weasel-js/react';
import type { FillStyle } from '@weasel-js/paint';
import { useFrameLoop } from './useFrameLoop';
import { useLateContentRedraw } from './useLateContentRedraw';
import { useRedrawOn } from './useRedrawOn';
import { paintCanvas, releaseCanvasRenderer } from './canvasRenderer';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import type { DrawCommand } from '../renderer/DrawCommand';
import type { RedrawSource } from '../core/layers/render';
import { normalizeView, type View } from '../core/viewport/view';

/** What a `<DrawCanvas>` paints: a command list, or a function returning one
 *  that is called on every paint with the surface's CSS-pixel size. */
export type DrawCanvasDraw =
  | readonly DrawCommand[]
  | ((size: { width: number; height: number }) => readonly DrawCommand[]);

/** Props for `<DrawCanvas>`. */
export interface DrawCanvasProps {
  /** CSS-pixel width. The drawing buffer is `width × dpr`. */
  width: number;
  /** CSS-pixel height. */
  height: number;
  /** The commands to paint, in the coordinate space `view` maps to the
   *  screen — CSS pixels when `view` is omitted. A new array repaints on the
   *  next frame. A function is read at paint time, so state it reads outside
   *  React repaints when one of `redrawOn`'s sources notifies. */
  draw: DrawCanvasDraw;
  /** Camera over `draw`'s commands. Defaults to the identity view. */
  view?: View;
  /** Fills the whole surface beneath `draw`, in screen space. The canvas is
   *  transparent without it. */
  background?: FillStyle;
  /** External state a `draw` function reads. Each source is subscribed while
   *  mounted and repaints the canvas when it notifies. */
  redrawOn?: readonly RedrawSource[];
  /** Device-pixel ratio. Defaults to `window.devicePixelRatio`, read per
   *  paint. */
  dpr?: number;
  /** CSS class for the `<canvas>` element. */
  className?: string;
  /** Receives the underlying `<canvas>`, for pointer listeners or `toBlob`. */
  canvasRef?: Ref<HTMLCanvasElement>;
}

const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * Paint draw commands onto a canvas of its own. For a surface that only draws —
 * a package demo, a swatch, a preview — where a `<SceneCanvas>` would bring a
 * scene, tools and an input dispatcher that nothing uses.
 */
export function DrawCanvas(props: DrawCanvasProps) {
  const { width, height, draw, background, redrawOn, dpr, className, canvasRef } = props;
  const view = props.view ? normalizeView(props.view) : IDENTITY_VIEW;

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const setRefs = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
    if (typeof canvasRef === 'function') canvasRef(el);
    else if (canvasRef) (canvasRef as { current: HTMLCanvasElement | null }).current = el;
  }, [canvasRef]);

  const paint = (): boolean => {
    const el = canvasElRef.current;
    if (!el) return false;
    const content = typeof draw === 'function' ? draw({ width, height }) : draw;
    const commands: DrawCommand[] = [];
    if (background) {
      commands.push({ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width, height }, fill: background });
    }
    commands.push({ kind: 'group', transform: viewToMat3(view), children: [...content] });
    return paintCanvas(el, commands, view, { width, height, dpr });
  };
  const paintRef = useLatest(paint);
  const { requestRedraw } = useFrameLoop(
    useCallback(() => paintRef.current(), [paintRef]),
    { target: canvasElRef },
  );

  // Every committed render marks the surface dirty; the first paints in place
  // so the first frame shown is the content rather than a blank canvas.
  const paintedRef = useRef(false);
  useLayoutEffect(() => {
    if (paintedRef.current) { requestRedraw(); return; }
    paintedRef.current = paintRef.current();
    if (!paintedRef.current) requestRedraw();
  });

  useLateContentRedraw(requestRedraw);
  useRedrawOn(redrawOn, requestRedraw);

  // The GL objects outlive the element's React state, so a remounting host
  // would otherwise walk into the browser's live-context cap.
  useEffect(() => {
    const el = canvasElRef.current;
    return () => {
      if (el) releaseCanvasRenderer(el);
      paintedRef.current = false;
    };
  }, []);

  return <canvas ref={setRefs} width={width} height={height} className={className} />;
}
