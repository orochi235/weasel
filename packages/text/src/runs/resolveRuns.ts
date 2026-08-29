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
 * `underline` / `strikethrough` are *additive*, like `bold`/`italic`: a run
 * can turn a decoration on but never off, so they resolve as
 * `run.x || style.x` and not `run.x ?? style.x`. See the header of
 * `runs/rangeStyle.ts` for why the model collapses the tri-state.
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
}

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
    out.push({
      text: run.text,
      fontFamily: run.fontFamily ?? style.fontFamily,
      fontSize: run.fontSize ?? style.fontSize,
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
    });
  }
  return out;
}
