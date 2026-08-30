/**
 * Apply node-level `ResolvedTextStyle` defaults to each `StyledRun`,
 * producing a fully-resolved run with every styling field set. Downstream
 * layout and draw never re-resolve defaults — `ResolvedRun` is the
 * canonical shape the renderer consumes.
 *
 * `bold`/`italic` toggles on a run are folded into `fontWeight`/`fontStyle`:
 * `bold: true` → fontWeight 700, `italic: true` → fontStyle 'italic'.
 * Explicit `fontFamily` / `fontSize` / `fill` / `letterSpacing` on the run
 * override the node-level value (`letterSpacing: 0` on a run is an override,
 * not an absence — it zeroes inherited tracking).
 *
 * `underline` / `strikethrough` / `overline` are *additive*, like
 * `bold`/`italic`: a run can turn a decoration on but never off, so they
 * resolve as `run.x || style.x` and not `run.x ?? style.x`. See the header of
 * `runs/rangeStyle.ts` for why the model collapses the tri-state.
 *
 * `script` is folded the same way the toggles are, into the two primitives it
 * is a preset over: `baselineShift` and `fontScale`. Both come out as one
 * world-unit `baselineShift` and a final `fontSize`, so layout never learns
 * that superscripts exist — it places a run against a baseline and an offset.
 */

import type { FillStyle, Stroke } from '@weasel-js/paint';
import type { StyledRun } from '../runs';
import type { ResolvedTextStyle } from '../textStyle';

/** A run with every style resolved against the node's text style — no
 *  optional inheritance left. This is what layout and painting consume. */
export interface ResolvedRun {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fill: FillStyle;
  /** Outline over this run's glyphs, or absent for none. Painted only on the
   *  outline tier — a distance field has no geometry to stroke. */
  stroke?: Stroke;
  /** Extra advance added after each glyph of this run, in world units. */
  letterSpacing: number;
  /** Draw a rule below this run's baseline. Additive over the node style. */
  underline: boolean;
  /** Draw a rule through this run's x-height. Additive over the node style. */
  strikethrough: boolean;
  /** Draw a rule above this run's ascent. Additive over the node style. */
  overline: boolean;
  /**
   * How far this run sits off the line's shared baseline, in world units;
   * positive raises. 0 for ordinary text.
   *
   * Already multiplied out against the inherited font size, and already
   * carrying whatever `script` asked for — layout adds it to a baseline and
   * asks nothing about where it came from.
   */
  baselineShift: number;
}

/**
 * What `script: 'super'` and `script: 'sub'` expand to, as fractions of the
 * inherited font size: `size` scales it, `shift` raises (positive) or lowers
 * (negative) the baseline.
 *
 * These are Adobe's defaults — InDesign and Illustrator ship 58.3% size and
 * 33.3% position for both — chosen because a drawing tool's users have those
 * numbers in their fingers already. They are not read from the font: the
 * `OS/2` table carries real `ySuperscript*` / `ySubscript*` metrics, but the
 * baked atlas tier has no slot for them (see `layoutRuns`'s note on the
 * decoration constants, which are derived for the same reason), and metrics
 * that applied on one glyph tier and not the other would reflow text as it
 * crossed the size threshold.
 *
 * Exported so a consumer building a character panel can show the percentages
 * it is about to apply. Override either half per run with `baselineShift` /
 * `fontScale`.
 */
export const SCRIPT_METRICS = Object.freeze({
  super: Object.freeze({ size: 0.583, shift: 0.333 }),
  sub: Object.freeze({ size: 0.583, shift: -0.333 }),
});

function numericWeight(w: number | string): number {
  if (typeof w === 'number') return w;
  if (w === 'bold') return 700;
  if (w === 'normal') return 400;
  const parsed = Number(w);
  return Number.isFinite(parsed) ? parsed : 400;
}

/** Resolve each run's styling against the node's text style, filling in
 *  everything the run left inherited. */
export function resolveRuns(
  runs: readonly StyledRun[],
  style: ResolvedTextStyle,
): ResolvedRun[] {
  const out: ResolvedRun[] = [];
  const baseWeight = numericWeight(style.fontWeight);
  for (const run of runs) {
    const script = run.script ? SCRIPT_METRICS[run.script] : undefined;
    // Against the inherited size, not the run's own: a superscript that also
    // shrank its rise would climb less the smaller it got.
    const shiftEm = run.baselineShift ?? script?.shift ?? 0;
    const scale = run.fontScale ?? script?.size ?? 1;
    out.push({
      text: run.text,
      fontFamily: run.fontFamily ?? style.fontFamily,
      // An absolute size wins over a relative one; naming both is a consumer
      // saying "this size exactly", which a multiplier cannot improve on.
      fontSize: run.fontSize ?? style.fontSize * scale,
      fontWeight: run.bold ? 700 : baseWeight,
      fontStyle: run.italic ? 'italic' : style.fontStyle,
      fill: run.fill ?? style.fill,
      // Unlike the decorations below, a run's stroke *replaces* the node's
      // rather than adding to it — there is only one outline to paint.
      ...((run.stroke ?? style.stroke) !== undefined
        ? { stroke: run.stroke ?? style.stroke }
        : {}),
      letterSpacing: run.letterSpacing ?? style.letterSpacing,
      // `||`, not `??`: run-level decorations are additive over the node style.
      underline: run.underline || style.underline,
      strikethrough: run.strikethrough || style.strikethrough,
      overline: run.overline || style.overline,
      baselineShift: shiftEm * style.fontSize,
    });
  }
  return out;
}
