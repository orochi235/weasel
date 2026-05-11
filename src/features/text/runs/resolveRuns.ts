/**
 * Apply node-level `ResolvedTextStyle` defaults to each `StyledRun`,
 * producing a fully-resolved run with every styling field set. Downstream
 * layout and draw never re-resolve defaults — `ResolvedRun` is the
 * canonical shape the renderer consumes.
 *
 * `bold`/`italic` toggles on a run are folded into `fontWeight`/`fontStyle`:
 * `bold: true` → fontWeight 700, `italic: true` → fontStyle 'italic'.
 * Explicit `fontFamily` / `fontSize` / `fill` on the run override the
 * node-level value.
 */

import type { Paint } from 'core/paint-types';
import type { StyledRun } from '../runs';
import type { ResolvedTextStyle } from '../textStyle';

export interface ResolvedRun {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fill: Paint;
}

function numericWeight(w: number | string): number {
  if (typeof w === 'number') return w;
  if (w === 'bold') return 700;
  if (w === 'normal') return 400;
  const parsed = Number(w);
  return Number.isFinite(parsed) ? parsed : 400;
}

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
    });
  }
  return out;
}
