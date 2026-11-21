import { luminanceContrast, relativeLuminance } from '@weasel-js/paint';

/** Fills the pixel with `color`, throwing where a canvas would ignore the color and keep the last fill. */
function fill(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = '#010203';
  ctx.fillStyle = color;
  const first = ctx.fillStyle;
  ctx.fillStyle = '#040506';
  ctx.fillStyle = color;
  if (ctx.fillStyle !== first) throw new Error(`painted: a canvas cannot parse the color ${JSON.stringify(color)}`);
  ctx.fillRect(0, 0, 1, 1);
}

/** `layers` painted bottom first. Throws when the result is not opaque, since what shows then depends on what is behind. */
function paint(layers: string[]): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  for (const layer of layers) fill(ctx, layer);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a !== 255) throw new Error(`painted: ${JSON.stringify(layers[0])} is not opaque; pass the backdrop it is drawn over`);
  return [r, g, b];
}

const under = (backdrop: string | undefined, ...layers: string[]) => (backdrop === undefined ? layers : [backdrop, ...layers]);

/**
 * `color` painted over `ground`, as the three channels a screen shows. A translucent ground throws unless given the
 * `backdrop` it is drawn over. Browser only: it reads a canvas.
 */
export function painted(color: string, ground: string, backdrop?: string): [number, number, number] {
  return paint(under(backdrop, ground, color));
}

const luminance = ([r, g, b]: [number, number, number]): number => relativeLuminance(r / 255, g / 255, b / 255);

/** WCAG's contrast ratio of two colors. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  return luminanceContrast(luminance(a), luminance(b));
}

/** The contrast of a line drawn in `line` on a fill of `fill`, both CSS colors, over `backdrop` if `fill` is translucent. */
export function lineContrast(line: string, fill: string, backdrop?: string): number {
  return contrast(paint(under(backdrop, fill, line)), paint(under(backdrop, fill)));
}
