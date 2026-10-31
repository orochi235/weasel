/**
 * `<DrawCanvas>` — a sized, DPR-correct WebGL2 surface that paints a list of
 * draw commands, with no scene, tools or dispatcher behind it.
 *
 * It paints through the same surface hook as `<SceneViewCanvas>`
 * (`useCanvasSurface`), whose frame loop stops while the canvas is off screen
 * or the tab is hidden. Like `<SceneViewCanvas>` it attaches no event
 * listeners. Its size is `width` × `height` unless a `className` rule sizes
 * the element; the drawing buffer stays `width` × `height` either way. Given
 * neither, it fills its parent.
 */
import { useCallback, useRef } from 'react';
import type { Ref } from 'react';
import { assignRef } from '@weasel-js/react';
import type { Paint } from '@weasel-js/paint';
import { useCanvasSurface } from './useCanvasSurface';
import { SurfaceCanvas } from './SurfaceCanvas';
import { useSurfaceSize, type SurfaceSizeProps } from './useSurfaceSize';
import type { CanvasRendererLease } from './canvasRenderer';
import { viewToMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RedrawSource } from '../core/layers/render';
import { backgroundFillCommands } from '../core/layers/backgroundFill';
import { normalizeView, type View } from '../core/viewport/view';

/** What a `<DrawCanvas>` paints: a command list, or a function returning one
 *  that is called on every paint with the surface's CSS-pixel size. */
export type DrawCanvasDraw =
  | readonly DrawCommand[]
  | ((size: { width: number; height: number }) => readonly DrawCommand[]);

/** Props for `<DrawCanvas>`. */
export interface DrawCanvasProps extends SurfaceSizeProps {
  /** The commands to paint, in the coordinate space `view` maps to the
   *  screen — CSS pixels when `view` is omitted. A new array repaints on the
   *  next frame. A function is read at paint time, so state it reads outside
   *  React repaints when one of `redrawOn`'s sources notifies. */
  draw: DrawCanvasDraw;
  /** Camera over `draw`'s commands. Defaults to the identity view. */
  view?: View;
  /** Fills the whole surface beneath `draw`, in screen space. The canvas is
   *  transparent without it. */
  background?: Paint;
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
  const { draw, background, redrawOn, dpr, className, canvasRef } = props;
  const view = props.view ? normalizeView(props.view) : IDENTITY_VIEW;

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const setRefs = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
    assignRef(canvasRef, el);
  }, [canvasRef]);
  const { width, height } = useSurfaceSize(props, canvasElRef);

  const paint = (lease: CanvasRendererLease): boolean => {
    const el = canvasElRef.current;
    if (!el || width === 0 || height === 0) return false;
    const content = typeof draw === 'function' ? draw({ width, height }) : draw;
    const commands: DrawCommand[] = background ? backgroundFillCommands(background, { width, height }) : [];
    commands.push({ kind: 'group', transform: viewToMat3(view), children: [...content] });
    return lease.paint(el, commands, view, { width, height, dpr });
  };
  useCanvasSurface(paint, { target: canvasElRef, dpr, redrawOn, onCommit: 'paint', size: { width, height } });

  return <SurfaceCanvas ref={setRefs} width={props.width} height={props.height} className={className} />;
}
