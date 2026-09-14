import { chromaCap, toHex, vividAt, type Anchor } from '@weasel-js/theme/engine';

/**
 * Named colors, each declared as a hue and a lightness — never as a hex.
 *
 * The color is the most chroma the sRGB gamut allows at that hue and lightness,
 * which is what "a bright crayon" means. So the two numbers in the row are the
 * two numbers worth arguing about, and nothing can be typed slightly wrong.
 *
 * Names matter because a palette's job is to identify things to a person:
 * "the turquoise one" is something one person can say to another about a
 * picture, and `#3ee1cb` is not.
 */
export const CRAYONS: Readonly<
  Record<string, readonly [hue: number, lightness: number, chromaFraction?: number]>
> = {
  // reds and pinks
  crimson: [18, 0.58],
  red: [28, 0.63],
  coral: [24, 0.72, 0.75],
  salmon: [26, 0.78, 0.55],
  rose: [0, 0.66],
  pink: [354, 0.75, 0.55],
  magenta: [340, 0.68],
  flamingo: [349, 0.79],
  fuchsia: [328, 0.70],

  // oranges and yellows
  vermilion: [40, 0.66],
  tangelo: [48, 0.70],
  orange: [55, 0.72],
  tangerine: [62, 0.76],
  amber: [72, 0.78],
  gold: [88, 0.82],
  citron: [99, 0.86],
  yellow: [110, 0.90],
  chartreuse: [119, 0.84],

  // greens
  lime: [128, 0.88],
  spring: [138, 0.84],
  green: [145, 0.80],
  grass: [150, 0.72],
  forest: [152, 0.55],
  emerald: [162, 0.74],
  seafoam: [172, 0.86],
  mint: [168, 0.88, 0.55],
  teal: [182, 0.78],

  // blues and cyans
  turquoise: [192, 0.82],
  cyan: [205, 0.83],
  cerulean: [222, 0.78],
  sky: [228, 0.80, 0.70],
  azure: [240, 0.72],
  blue: [258, 0.62],
  cobalt: [264, 0.55],
  navy: [266, 0.42, 0.85],
  periwinkle: [274, 0.76, 0.55],

  // purples
  indigo: [284, 0.48],
  violet: [292, 0.55],
  amethyst: [299, 0.68],
  purple: [305, 0.52],
  orchid: [312, 0.72],
  lavender: [300, 0.82, 0.45],
  plum: [330, 0.50, 0.60],

  // browns and earth
  maroon: [20, 0.42, 0.70],
  brick: [30, 0.50, 0.65],
  rust: [44, 0.55, 0.70],
  brown: [55, 0.48, 0.50],
  cocoa: [58, 0.38, 0.45],
  tan: [70, 0.74, 0.30],
  khaki: [96, 0.72, 0.32],
  olive: [110, 0.55, 0.55],
  moss: [130, 0.58, 0.45],
  slate: [240, 0.58, 0.18],
};

export type CrayonName = keyof typeof CRAYONS;

/** The color a named crayon resolves to. */
export function crayonHex(name: string): string {
  const row = CRAYONS[name];
  if (!row) return '#000000';
  const [hue, lightness, fraction] = row;
  return fraction === undefined
    ? vividAt(lightness, hue)
    : toHex(lightness, chromaCap(lightness, hue) * fraction, hue);
}

export function crayonAnchor(name: string): Anchor {
  const row = CRAYONS[name];
  if (!row) return { name, hue: 0, lightness: 0.6 };
  const [hue, lightness, fraction] = row;
  return {
    name,
    hue,
    lightness,
    chroma: fraction === undefined ? undefined : chromaCap(lightness, hue) * fraction,
  };
}

/** The sharpest case for pinning, and what the anchor tests use. */
export const YELLOW_ANCHOR: Anchor = crayonAnchor('yellow');
