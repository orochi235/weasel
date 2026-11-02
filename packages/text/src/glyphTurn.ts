import { DEG_TO_RAD } from '@weasel-js/geom';

/** A glyph turned `rotate` degrees, clockwise with y down, as the cosine and
 *  sine its points turn by: `x' = x·cos − y·sin`, `y' = x·sin + y·cos`. */
export function glyphTurn(rotate: number | undefined): readonly [number, number] {
  if (!rotate) return UPRIGHT;
  const rad = rotate * DEG_TO_RAD;
  return [Math.cos(rad), Math.sin(rad)];
}

const UPRIGHT = [1, 0] as const;
