/**
 * The exact color at a screen point: a stack of render layers drawn again,
 * offscreen, into the few device pixels around the point, at the view and
 * pixel ratio the canvas paints them at. Nothing the canvas draws over those
 * layers — selection handles, guides, a loupe's own window — is in it.
 */
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { rgbaHex } from '@weasel-js/paint';
import { cullDrawCommands, type DrawCommand } from '@weasel-js/renderer';
import { drawOneLayer, type LayerDims, type RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { createRasterSession, type RasterSession, type RasterSessionOptions } from './renderSceneToPixels';

/** Device pixels on a side of the region a sample draws; the color is its middle one. */
const SPAN = 3;

/** What to sample: the layers, how the canvas draws them, and where. */
export interface LayerSampleArgs {
  /** The layers to draw, bottom first, as the canvas stacks them. */
  layers: readonly RenderLayer<unknown>[];
  /** What the canvas hands its layers as `data`. */
  data?: unknown;
  /** The view the canvas draws them through. */
  view: View;
  /** The canvas's CSS size and its device pixels to the CSS pixel. */
  dims: LayerDims;
  /** The point, CSS px from the canvas's top-left. */
  point: { x: number; y: number };
}

/** The frame a sample draws: commands placed in a `width × height` raster, and
 *  the raster pixel holding the point. */
export interface LayerSamplePlan {
  commands: DrawCommand[];
  width: number;
  height: number;
  /** Canvas CSS px → raster pixels, which is also where `'screen'`-unit paint is measured. */
  screen: GlMat3;
  center: { x: number; y: number };
}

/**
 * The frame that redraws `layers` into a small raster centered on the device
 * pixel under `point`. The raster's grid is the canvas's own, offset by whole
 * device pixels, so each pixel covers what the canvas's pixel there covers.
 * `null` for a point off the canvas, or not a number.
 */
export function planLayerSample(args: LayerSampleArgs): LayerSamplePlan | null {
  const { layers, data, view, dims, point } = args;
  if (!(point.x >= 0 && point.y >= 0 && point.x < dims.width && point.y < dims.height)) return null;
  const half = Math.floor(SPAN / 2);
  const ox = Math.floor(point.x * dims.dpr) - half;
  const oy = Math.floor(point.y * dims.dpr) - half;
  const screen = mat3.scaled(mat3.translated(mat3.identity(), -ox, -oy), dims.dpr, dims.dpr);
  const children: DrawCommand[] = [];
  for (const layer of layers) {
    for (const c of drawOneLayer(layer, data, view, dims)) children.push(c);
  }
  // Only what can reach the region is drawn: the rest of the picture is
  // a whole frame of work for pixels the read never looks at.
  const region = { x: ox / dims.dpr, y: oy / dims.dpr, width: SPAN / dims.dpr, height: SPAN / dims.dpr };
  return {
    commands: [{ kind: 'group', transform: screen, children: cullDrawCommands(children, mat3.identity(), region, dims.dpr) }],
    width: SPAN,
    height: SPAN,
    screen,
    center: { x: half, y: half },
  };
}

/** Samples a stack of layers exactly, through one offscreen renderer. */
export interface LayerSampler {
  /** Straight RGBA at the point, or `null` off the canvas or where no WebGL2
   *  context can be had (jsdom). */
  rgba(args: LayerSampleArgs): Uint8ClampedArray | null;
  /** {@link rgba} as `#rrggbb`; `null` too where nothing is drawn. */
  sample(args: LayerSampleArgs): string | null;
  /** Free the renderer. Idempotent; a later sample opens another. */
  dispose(): void;
}

/**
 * A {@link LayerSampler}. It renders through a {@link RasterSession} opened on
 * the first sample and kept until `dispose`, so a pointer moving over the
 * canvas compiles nothing after its first sample.
 */
export function createLayerSampler(options: RasterSessionOptions = {}): LayerSampler {
  let session: RasterSession | null = null;
  const rgba = (args: LayerSampleArgs): Uint8ClampedArray | null => {
    const plan = planLayerSample(args);
    if (!plan) return null;
    session ??= createRasterSession(options);
    let image;
    try {
      image = session.renderCommands(plan.commands, plan, { screen: plan.screen });
    } catch {
      // No WebGL2 here, or a context lost: there is nothing to read.
      session.dispose();
      session = null;
      return null;
    }
    const i = (plan.center.y * plan.width + plan.center.x) * 4;
    return image.data.slice(i, i + 4);
  };
  return {
    rgba,
    sample(args) {
      const px = rgba(args);
      return px ? rgbaHex(px) : null;
    },
    dispose() {
      session?.dispose();
      session = null;
    },
  };
}
