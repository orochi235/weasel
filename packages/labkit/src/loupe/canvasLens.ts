import type { LoupePoint } from '@weasel-js/loupe';
import { centerOn } from '../canvas/camera';
import { screenToWorld } from '../canvas/canvasCoords';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { DEFAULT_FRAME, resolveFrame, type WorldFrame, type WorldSpec } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';

/** The camera a round lens of `diameter` shows a magnified region through, and
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
  diameter: number,
  worldSpec?: WorldSpec,
): LensCamera {
  const size = { width: diameter, height: diameter };
  const frame = resolveFrame(worldSpec, size);
  const world = screenToWorld(aim, outer, outerFrame);
  return { view: centerOn(world, outer.zoom * factor, size, frame), frame };
}

/** A rectangle in a backing store's own device pixels. */
export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * The region a pixel-mode lens copies out of a presented canvas: the `diameter
 * / factor` CSS px around `aim`, in that canvas' backing-store pixels.
 */
export function lensSourceRect(
  aim: LoupePoint,
  factor: number,
  diameter: number,
  dpr: number,
): SourceRect {
  const span = diameter / factor;
  return {
    sx: (aim.x - span / 2) * dpr,
    sy: (aim.y - span / 2) * dpr,
    sw: span * dpr,
    sh: span * dpr,
  };
}

/**
 * The colour a stack presents at a point: the topmost visible layer with
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
    diameter: number;
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
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, diameter, diameter);

  if (mode === 'pixel') {
    const { sx, sy, sw, sh } = lensSourceRect(aim, factor, diameter, dpr);
    ctx.imageSmoothingEnabled = false;
    for (const layer of layers) {
      if (!layer.visible) continue;
      const canvas = canvases.get(layer.id);
      if (!canvas || canvas.width === 0 || canvas.height === 0) continue;
      ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, diameter, diameter);
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
