import type { FaceMetrics, FaceRuleMetrics } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import type { PlacedGlyph } from './layoutRuns';

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

/** One rule drawn across a stretch of a line. */
export interface DecorationRule {
  kind: DecorationKind;
  x0: number; y0: number; x1: number; y1: number;
  /** The run that opened the stretch. Every run in it paints its rules alike. */
  run: number;
}

/** Builds one line's decoration rules from its glyphs, fed in visual order. */
export interface LineDecorations {
  /** Take the next glyph. Its fields are read now and not kept. */
  add(g: PlacedGlyph): void;
  /** The line's rules. */
  end(): DecorationRule[];
}

/**
 * The decoration rules of one line, in visual order; within a stretch,
 * underline then strikethrough then overline.
 *
 * Fed the whole line in visual order. A rule runs across adjacent
 * glyphs whose runs agree on which rules to draw, on the size, face and
 * baseline that place them, and on `paintOf`: the identity of the paint a
 * run's rules wear, or null for a run that draws none. It is built from pen
 * positions rather than ink, so it covers the spaces, tracking and kerning
 * inside the stretch, and two alike runs join without a seam.
 */
export function lineDecorations(
  runs: readonly ResolvedRun[],
  faceOf: (run: number) => FaceMetrics | undefined,
  paintOf: (run: number) => string | null,
): LineDecorations {
  interface Stretch {
    run: number;
    style: ResolvedRun;
    face: FaceMetrics | undefined;
    paint: string;
    baselineY: number;
    x0: number;
    x1: number;
  }
  const rules: DecorationRule[] = [];
  let open: Stretch | null = null;
  const close = (): void => {
    const s = open;
    open = null;
    if (!s || s.x1 <= s.x0) return;
    for (const kind of DECORATION_KINDS) {
      if (!s.style[kind]) continue;
      // The run's size, not the glyph's: a small-caps word is one rule.
      const { y0, y1 } = decorationRule(kind, s.baselineY, s.style.fontSize, s.face);
      rules.push({ kind, x0: s.x0, y0, x1: s.x1, y1, run: s.run });
    }
  };

  return {
    add(g) {
      const style = runs[g.run];
      // Flags first: `paintOf` builds a string, and most text has no rule.
      const paint = style.underline || style.strikethrough || style.overline ? paintOf(g.run) : null;
      if (paint === null) {
        if (open !== null) close();
        return;
      }
      const face = faceOf(g.run);
      const joins = open !== null
        && DECORATION_KINDS.every((kind) => open!.style[kind] === style[kind])
        && open.style.fontSize === style.fontSize
        && open.face === face
        && open.baselineY === g.baselineY
        && open.paint === paint;
      if (joins) {
        open!.x1 = g.x + g.step;
      } else {
        close();
        open = { run: g.run, style, face, paint, baselineY: g.baselineY, x0: g.x, x1: g.x + g.step };
      }
    },
    end() {
      close();
      return rules;
    },
  };
}
