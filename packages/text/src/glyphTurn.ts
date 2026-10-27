/** A glyph turned `rotate` degrees, clockwise with y down, as the cosine and
 *  sine its points turn by: `x' = x·cos − y·sin`, `y' = x·sin + y·cos`. */
export function glyphTurn(rotate: number | undefined): readonly [number, number] {
  if (!rotate) return UPRIGHT;
  const rad = (rotate * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

const UPRIGHT = [1, 0] as const;
