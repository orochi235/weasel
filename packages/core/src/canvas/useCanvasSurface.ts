import type { ShaderProgramHandle } from '@weasel-js/renderer';
import type { RedrawSource } from '../core/layers/render';
import type { CanvasRendererLease } from './canvasRenderer';
import {
  useCanvasRenderer, useRedrawOnDensityChange, useRedrawOnRestore, useRedrawOnShaderSource,
} from './useCanvasRenderer';
import { useFrameLoop, type FrameLoop, type FrameLoopOptions } from './useFrameLoop';
import { useLateContentRedraw } from './useLateContentRedraw';
import { useRedrawOn } from './useRedrawOn';

/** What a surface tells {@link useCanvasSurface} about itself, beyond its paint. */
export interface CanvasSurfaceOptions extends FrameLoopOptions {
  /** The surface's own density. Omit to follow `devicePixelRatio`. */
  dpr?: number;
  /** External state the paint reads; each source repaints when it notifies. */
  redrawOn?: readonly RedrawSource[];
  /** Custom programs the paint draws with; new source for one repaints. */
  shaders?: readonly ShaderProgramHandle[];
}

/** A surface's frame loop and the renderer lease its paint draws through. */
export interface CanvasSurface extends FrameLoop {
  lease: CanvasRendererLease;
}

/**
 * Everything a canvas surface in core needs around its paint: the renderer
 * lease, the frame loop, and a repaint for each thing that changes pixels with
 * no React render behind it — a restored GL context, a density change, late
 * content, a re-registered shader, and the caller's own `redrawOn` sources.
 *
 * @param paint As `useFrameLoop`'s, handed the lease to draw through.
 */
export function useCanvasSurface(
  paint: (lease: CanvasRendererLease) => boolean,
  options: CanvasSurfaceOptions = {},
): CanvasSurface {
  const lease = useCanvasRenderer();
  const loop = useFrameLoop(() => paint(lease), options);
  const { requestRedraw } = loop;
  useRedrawOnRestore(lease, requestRedraw);
  useRedrawOnDensityChange(requestRedraw, options.dpr);
  useLateContentRedraw(requestRedraw);
  useRedrawOnShaderSource(options.shaders, requestRedraw);
  useRedrawOn(options.redrawOn, requestRedraw);
  return { ...loop, lease };
}
