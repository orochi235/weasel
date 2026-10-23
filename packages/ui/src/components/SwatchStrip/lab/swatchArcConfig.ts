import type { AlongArc, RunAlign } from '@weasel-js/ui/components/Along';
import { BASIC_PALETTE, STANDARD_PALETTE, type SwatchPalette } from '../palettes';

/** The knobs the swatches-on-an-arc lab reads. */
export interface SwatchArcConfig {
  swatches: { palettes: 'basic' | 'standard' | 'both'; recent: number; columns: number; align: RunAlign };
  arc: { center: number; sweep: number; direction: 'cw' | 'ccw'; inset: number; size: number };
}

/** Every knob at its default: a top arc wide enough to hold the recent row and the basic palette. */
export const SWATCH_ARC_DEFAULTS: SwatchArcConfig = {
  swatches: { palettes: 'basic', recent: 6, columns: 10, align: 'center' },
  arc: { center: 0, sweep: 110, direction: 'cw', inset: 16, size: 520 },
};

/** The arc centered on `center`, `sweep` degrees long, running `direction` from start to end. */
export function swatchArcOf({ center, sweep, direction, inset }: Omit<SwatchArcConfig['arc'], 'size'>): AlongArc {
  return { at: center, span: `${sweep}deg`, direction, inset };
}

/** The palettes the strip offers. */
export function palettesOf(which: SwatchArcConfig['swatches']['palettes']): SwatchPalette[] {
  if (which === 'both') return [BASIC_PALETTE, STANDARD_PALETTE];
  return [which === 'basic' ? BASIC_PALETTE : STANDARD_PALETTE];
}

/** `n` shades from across the standard palette's hue ramps, every seventh, standing in for colors used recently. */
export function recentColors(n: number): string[] {
  return STANDARD_PALETTE.colors.slice(20).filter((_, i) => i % 7 === 3).slice(0, n).map((c) => c.value!);
}
