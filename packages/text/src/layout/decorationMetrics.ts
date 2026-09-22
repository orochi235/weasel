/** The three text decoration rules, in the order every tier paints them. */
export type DecorationKind = 'underline' | 'strikethrough' | 'overline';

export const DECORATION_KINDS: readonly DecorationKind[] = ['underline', 'strikethrough', 'overline'];

/**
 * Decoration placement and weight, as fractions of the run's `fontSize`.
 * Offsets are the *top* edge of the rule, measured down from the baseline —
 * so the two rules that sit above it are negative.
 *
 * DERIVED, NOT MEASURED. `BmFont` exposes only `info.size`, `common.base`
 * and `common.lineHeight` — a BMFont JSON carries no decoration metrics at
 * all. A future HarfBuzz / OpenType path would read the real
 * `underlinePosition` and `underlineThickness` off the `post` table and
 * retire these numbers.
 *
 * Pinned by `tests/visual/text-decoration.spec.ts`, which measures the gap
 * between the two rules rather than a golden image — `text.spec.ts`'s 5%
 * tolerance cannot see one of these move.
 */
const UNDERLINE_OFFSET = 0.10;
const STRIKETHROUGH_OFFSET = -0.30;
const OVERLINE_OFFSET = -0.90;
const DECORATION_THICKNESS = 0.05;

const OFFSET: Record<DecorationKind, number> = {
  underline: UNDERLINE_OFFSET,
  strikethrough: STRIKETHROUGH_OFFSET,
  overline: OVERLINE_OFFSET,
};

/**
 * The vertical extent of one decoration rule for a run of `fontSize` whose
 * baseline sits at `baselineY` (y grows down). Every text tier places its
 * rules through this, so a rule sits in the same place whichever one paints it.
 */
export function decorationRule(
  kind: DecorationKind,
  baselineY: number,
  fontSize: number,
): { y0: number; y1: number } {
  const y0 = baselineY + fontSize * OFFSET[kind];
  return { y0, y1: y0 + fontSize * DECORATION_THICKNESS };
}
