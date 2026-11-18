import { lerp } from '@weasel-js/geom';
import { chromaCap, toHex } from './oklch.ts';
import type { Anchor, Constraints } from './generate.ts';

/** Lightness at which a hue reaches its highest chroma. */
function peakLightness(H: number): number {
  let bestL = 0.5;
  let bestC = -1;
  for (let L = 0.32; L <= 0.96; L += 0.01) {
    const c = chromaCap(L, H);
    if (c > bestC) {
      bestC = c;
      bestL = L;
    }
  }
  return bestL;
}

const PEAK: (number | undefined)[] = new Array(360);
const hueIndex = (H: number) => ((Math.round(H) % 360) + 360) % 360;

/** {@link peakLightness} at the whole degree nearest `H`, computed once per degree. */
export const peakAt = (H: number) => (PEAK[hueIndex(H)] ??= peakLightness(hueIndex(H)));

/** The default law: sit near this hue's chroma peak, pulled toward the target. */
export function place(
  H: number,
  c: Pick<Constraints, 'lightnessTarget' | 'lightnessPull' | 'chromaFraction'>,
): string {
  const L = lerp(peakAt(H), c.lightnessTarget, c.lightnessPull);
  return toHex(L, chromaCap(L, H) * c.chromaFraction, H);
}

/** The color an anchor will actually contribute, for a swatch beside its controls. */
export function toHexPreview(a: Pick<Anchor, 'hue' | 'lightness' | 'chroma'>): string {
  const cap = chromaCap(a.lightness, a.hue);
  return toHex(a.lightness, a.chroma === undefined ? cap : Math.min(a.chroma, cap), a.hue);
}
