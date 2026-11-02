import { luminanceContrast, relativeLuminance } from '@weasel-js/paint';

/** `color` painted over `ground`, as the three channels a screen shows. Browser only: it reads a canvas. */
export function painted(color: string, ground: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  for (const fill of [ground, color]) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 1, 1);
  }
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const luminance = ([r, g, b]: [number, number, number]): number => relativeLuminance(r / 255, g / 255, b / 255);

/** WCAG's contrast ratio of two colors. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  return luminanceContrast(luminance(a), luminance(b));
}

/** The contrast of a line drawn in `line` on a fill of `fill`, both CSS colors. */
export function lineContrast(line: string, fill: string): number {
  return contrast(painted(line, fill), painted(fill, fill));
}
