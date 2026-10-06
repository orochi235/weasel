import { type LoupePoint, type LoupeSize, loupeExtent } from '@weasel-js/loupe';
import { centerOn } from '../canvas/camera';
import { screenToWorld } from '../canvas/canvasCoords';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { DEFAULT_FRAME, resolveFrame, type WorldFrame, type WorldSpec } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';

/** The camera a lens of `size` shows a magnified region through, and
 *  the coordinate system it is read in — the instrument's own `WorldSpec`,
 *  resolved against the lens rather than the stack. */
export interface LensCamera {
  view: ViewTransform;
  frame: WorldFrame;
}

/**
 * What a lens aimed at `aim` renders the stack's layers through.
 *
 * The lens is its own viewport, so the world spec resolves against its box: an
 * instrument centred on its viewport is centred in the lens too.
 */
export function lensCamera(
  aim: LoupePoint,
  outer: ViewTransform,
  outerFrame: WorldFrame,
  factor: number,
  size: LoupeSize,
  worldSpec?: WorldSpec,
): LensCamera {
  const extent = loupeExtent(size);
  const frame = resolveFrame(worldSpec, extent);
  const world = screenToWorld(aim, outer, outerFrame);
  return { view: centerOn(world, outer.zoom * factor, extent, frame), frame };
}

/** A rectangle in a backing store's own device pixels. */
export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * The region a pixel-mode lens copies out of a presented canvas: `size /
 * factor` CSS px around `aim`, in that canvas' backing-store pixels.
 */
export function lensSourceRect(
  aim: LoupePoint,
  factor: number,
  size: LoupeSize,
  dpr: number,
): SourceRect {
  const { width, height } = loupeExtent(size);
  const spanX = width / factor;
  const spanY = height / factor;
  return {
    sx: (aim.x - spanX / 2) * dpr,
    sy: (aim.y - spanY / 2) * dpr,
    sw: spanX * dpr,
    sh: spanY * dpr,
  };
}

/**
 * The color a stack presents at a point: the topmost visible layer with
 * anything opaque there, or `null` when every layer is transparent — which is
 * the honest answer for a point showing nothing but the workspace behind.
 */
export function sampleStack(
  layers: readonly CanvasLayerDescriptor[],
  canvases: Map<string, HTMLCanvasElement>,
  p: LoupePoint,
  dpr: number,
): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    const canvas = canvases.get(layer.id);
    if (!canvas) continue;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    const x = Math.floor(p.x * dpr);
    const y = Math.floor(p.y * dpr);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
    if (a === 0) continue;
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  return null;
}

/** Redraw the stack into a lens' own canvas. `mode` decides whether the layers
 *  are re-run at the lens camera or their presented pixels are enlarged. */
export function drawCanvasLens(
  ctx: CanvasRenderingContext2D,
  opts: {
    aim: LoupePoint;
    factor: number;
    diameter: LoupeSize;
    dpr: number;
    mode: 'vector' | 'pixel';
    outer: ViewTransform;
    outerFrame?: WorldFrame;
    worldSpec?: WorldSpec;
    layers: readonly CanvasLayerDescriptor[];
    canvases: Map<string, HTMLCanvasElement>;
  },
): void {
  const { aim, factor, diameter, dpr, mode, outer, layers, canvases } = opts;
  const { width, height } = loupeExtent(diameter);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (mode === 'pixel') {
    const { sx, sy, sw, sh } = lensSourceRect(aim, factor, diameter, dpr);
    ctx.imageSmoothingEnabled = false;
    for (const layer of layers) {
      if (!layer.visible) continue;
      const canvas = canvases.get(layer.id);
      if (!canvas || canvas.width === 0 || canvas.height === 0) continue;
      ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, width, height);
    }
    ctx.restore();
    return;
  }

  const lens = lensCamera(
    aim,
    outer,
    opts.outerFrame ?? DEFAULT_FRAME,
    factor,
    diameter,
    opts.worldSpec,
  );
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    layer.render(ctx, lens.view, lens.frame);
    ctx.restore();
  }
  ctx.restore();
}
