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

/**
 * `top` painted over `ground`, whose layers go bottom first. Throws when the ground is not opaque, since what shows then
 * depends on what is behind it; an opaque `top` would otherwise hide that.
 */
function paint(ground: string[], top?: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  for (const layer of ground) fill(ctx, layer);
  if (ctx.getImageData(0, 0, 1, 1).data[3] !== 255) {
    throw new Error(`painted: ${JSON.stringify(ground[ground.length - 1])} is not opaque; pass the backdrop it is drawn over`);
  }
  if (top !== undefined) fill(ctx, top);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const under = (backdrop: string | undefined, ground: string) => (backdrop === undefined ? [ground] : [backdrop, ground]);

/**
 * `color` painted over `ground`, as the three channels a screen shows. A translucent ground throws unless given the
 * `backdrop` it is drawn over. Browser only: it reads a canvas.
 */
export function painted(color: string, ground: string, backdrop?: string): [number, number, number] {
  return paint(under(backdrop, ground), color);
}

const luminance = ([r, g, b]: [number, number, number]): number => relativeLuminance(r / 255, g / 255, b / 255);

/** WCAG's contrast ratio of two colors. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  return luminanceContrast(luminance(a), luminance(b));
}

/** The contrast of a line drawn in `line` on a fill of `fill`, both CSS colors, over `backdrop` if `fill` is translucent. */
export function lineContrast(line: string, fill: string, backdrop?: string): number {
  return contrast(paint(under(backdrop, fill), line), paint(under(backdrop, fill)));
}
