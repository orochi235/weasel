import type { FaceMetrics, FaceRuleMetrics } from '@weasel-js/font';

/** The three text decoration rules, in the order every tier paints them. */
export type DecorationKind = 'underline' | 'strikethrough' | 'overline';

export const DECORATION_KINDS: readonly DecorationKind[] = ['underline', 'strikethrough', 'overline'];

/**
 * Decoration placement and weight for a face that states none, as fractions
 * of the run's `fontSize`. Offsets are the *top* edge of the rule, measured
 * down from the baseline — so the two rules that sit above it are negative.
 *
 * Derived, not measured: they apply to an atlas baked before `gen-font`
 * recorded `faceMetrics`, a custom outline parser that reports none, and the
 * canvas tier, which has no font tables to read.
 */
export const DEFAULT_DECORATION_METRICS: Readonly<Record<DecorationKind, FaceRuleMetrics>> = Object.freeze({
  underline: Object.freeze({ offset: 0.10, thickness: 0.05 }),
  strikethrough: Object.freeze({ offset: -0.30, thickness: 0.05 }),
  overline: Object.freeze({ offset: -0.90, thickness: 0.05 }),
});

const resolved = new WeakMap<FaceMetrics, Readonly<Record<DecorationKind, FaceRuleMetrics>>>();

/**
 * Where each rule sits for a face, in ems: the face's own underline and
 * strikeout where it states them, the defaults where it does not. No font
 * table places an overline, so it keeps the default offset and takes the
 * underline's weight, as browsers draw it.
 *
 * Every text tier places its rules through this, so one face puts a rule in
 * the same place whichever tier paints it.
 */
export function decorationMetrics(face?: FaceMetrics): Readonly<Record<DecorationKind, FaceRuleMetrics>> {
  if (!face) return DEFAULT_DECORATION_METRICS;
  let out = resolved.get(face);
  if (!out) {
    const underline = face.underline ?? DEFAULT_DECORATION_METRICS.underline;
    out = Object.freeze({
      underline,
      strikethrough: face.strikethrough ?? DEFAULT_DECORATION_METRICS.strikethrough,
      overline: Object.freeze({ offset: DEFAULT_DECORATION_METRICS.overline.offset, thickness: underline.thickness }),
    });
    resolved.set(face, out);
  }
  return out;
}

/**
 * The vertical extent of one decoration rule for a run of `fontSize` whose
 * baseline sits at `baselineY` (y grows down), set in `face`.
 */
export function decorationRule(
  kind: DecorationKind,
  baselineY: number,
  fontSize: number,
  face?: FaceMetrics,
): { y0: number; y1: number } {
  const m = decorationMetrics(face)[kind];
  const y0 = baselineY + fontSize * m.offset;
  return { y0, y1: y0 + fontSize * m.thickness };
}
