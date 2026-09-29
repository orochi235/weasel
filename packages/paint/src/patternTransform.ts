/**
 * A pattern tile's linear map into paint space: `[a, b, c, d]`, the first
 * four entries of SVG's `matrix(a b c d e f)`. A tile point `(u, v)` lands at
 * `origin + (a·u + c·v, b·u + d·v)`. Translation is the paint's `origin`, so
 * it has no slot here.
 */
export type PatternTransform = readonly [a: number, b: number, c: number, d: number];

/**
 * A {@link PatternTransform} as the parts an editor shows. Angles are radians.
 * Applied in the order scale, then skew, then rotation — rotation outermost,
 * so turning a skewed tile turns it whole.
 */
export interface PatternTransformParts {
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** Shear of the tile's y axis toward x, as SVG `skewX()`. */
  skewX: number;
}

/** `R(rotation) · K(skewX) · S(scaleX, scaleY)`. Omitted parts are identity. */
export function composePatternTransform(parts: Partial<PatternTransformParts>): PatternTransform {
  const { rotation = 0, scaleX = 1, scaleY = 1, skewX = 0 } = parts;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const shear = Math.tan(skewX) * scaleY;
  return [
    cos * scaleX,
    sin * scaleX,
    cos * shear - sin * scaleY,
    sin * shear + cos * scaleY,
  ];
}

/**
 * Inverse of {@link composePatternTransform}. Any 2×2 matrix decomposes this
 * way; a reflection comes back as a negative `scaleY`. `undefined` reads as the
 * identity, which is what an absent `transform` means.
 */
export function decomposePatternTransform(t: PatternTransform | undefined): PatternTransformParts {
  if (!t) return { rotation: 0, scaleX: 1, scaleY: 1, skewX: 0 };
  const [a, b, c, d] = t;
  const scaleX = Math.hypot(a, b);
  const rotation = scaleX === 0 ? 0 : Math.atan2(b, a);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const shear = c * cos + d * sin;
  const scaleY = d * cos - c * sin;
  const skewX = scaleY === 0 ? 0 : Math.atan(shear / scaleY);
  return { rotation, scaleX, scaleY, skewX };
}
