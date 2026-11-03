/**
 * A label's scene to the pixels a printer lays down: one pixel per dot, the printable band only.
 */
import { renderSceneToPixels, warmRender, type RasterImage, type RenderSceneToPixelsArgs } from '@weasel-js/core';
import type { OutputGrid } from '@weasel-js/geom';
import type { MediaSpec } from 'obwat';
import type { Tape } from './tape';

/** Where a label sits in its scene and what it prints on. Scene units are points. */
export interface LabelGeometry {
  /** Length along the tape, in points: the label's width in the scene. */
  length: number;
  tape: Tape;
  /** The printer's geometry for this tape: `Printers.ptP710bt.media(tape.widthMm)`, or what `queryMedia` reports. */
  media: MediaSpec;
  /** The label's top-left corner in the scene. Default `(0, 0)`. */
  origin?: { x: number; y: number };
}

/**
 * The strip across the tape the printhead reaches, in points from the tape's top edge:
 * `printableDots` at `dpi`, centered. Content outside it does not print.
 */
export function printableBand(tape: Tape, media: MediaSpec): { y: number; height: number } {
  const height = media.printableDots * (72 / media.dpi);
  return { y: (tape.widthPt - height) / 2, height };
}

/**
 * The source rect and scale that render a label at one pixel per printer dot. The rect is the
 * printable band, so the output is exactly `printableDots` tall and the label's length in dots long.
 */
export function labelRenderPlan({ length, tape, media, origin = { x: 0, y: 0 } }: LabelGeometry): {
  sourceRect: { x: number; y: number; width: number; height: number };
  scale: { x: number; y: number };
} {
  const band = printableBand(tape, media);
  const dotsPerPt = media.dpi / 72;
  return {
    sourceRect: { x: origin.x, y: origin.y + band.y, width: length, height: band.height },
    scale: { x: dotsPerPt, y: dotsPerPt },
  };
}

/**
 * The printer's dot grid in scene units: one dot's size, and the corner of the dot that prints
 * first, at the top of the printable band. `protectRects` from `@weasel-js/dither` takes it to place
 * rects a dither must leave at a plain threshold, such as a barcode and its quiet zone.
 */
export function labelGrid({ tape, media, origin = { x: 0, y: 0 } }: Omit<LabelGeometry, 'length'>): OutputGrid {
  return { pitch: 72 / media.dpi, origin: { x: origin.x, y: origin.y + printableBand(tape, media).y } };
}

/** What {@link renderLabel} takes: the label's geometry, and what `renderSceneToPixels` takes besides its rect and scale. */
export type RenderLabelArgs<TData, TLayer extends string, TPose> = LabelGeometry &
  Omit<RenderSceneToPixelsArgs<TData, TLayer, TPose>, 'sourceRect' | 'scale'>;

/**
 * Render a label to straight RGBA at the printer's resolution, on white unless `background` says
 * otherwise: the image `printLabel` takes. Loads the fonts and paint kinds the scene draws with first.
 */
export async function renderLabel<TData, TLayer extends string, TPose>(
  args: RenderLabelArgs<TData, TLayer, TPose>,
): Promise<RasterImage> {
  const { length, tape, media, origin, ...rest } = args;
  const render = { background: '#ffffff', ...rest, ...labelRenderPlan({ length, tape, media, origin }) };
  await warmRender({ render });
  return renderSceneToPixels(render);
}
