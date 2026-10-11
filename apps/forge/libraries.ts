import type { Library } from '@weasel-js/forge';

/** `swatch` mixed toward the foreground, further in light mode: a bright swatch needs more of the dark foreground to
 *  hold 4.5:1 as small text on its own tint, and a dark swatch less of the light one. */
const tone = (swatch: string, light: number, dark: number): string =>
  `light-dark(color-mix(in oklab, var(--wzl-swatch-${swatch}), var(--wzl-fg) ${light}%), ` +
  `color-mix(in oklab, var(--wzl-swatch-${swatch}), var(--wzl-fg) ${dark}%))`;

const FORGE_TONE = tone('blue', 55, 35);

/**
 * This repo's libraries, by the package a story file lives in rather than by its title's first segment: the title
 * prefix is authored per story and disagrees with itself, and `packages/ui` alone declares both `Primitives/` and `ui/`.
 */
export const LIBRARIES: readonly Library[] = [
  { path: '/packages/ui/', label: 'ui', tone: tone('amber', 55, 40) },
  { path: '/packages/labkit/', label: 'labkit', tone: tone('teal', 55, 45) },
  { path: '/packages/forge/', label: 'forge', tone: FORGE_TONE },
  { path: '/apps/draw/', label: 'draw', tone: tone('rose', 55, 35) },
  { path: '/apps/forge/', label: 'forge', tone: FORGE_TONE },
];
