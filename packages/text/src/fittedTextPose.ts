import type { ScreenLength } from '@weasel-js/paint';
import { textFitScale } from './layout/textPoseLayout';
import type { TextPose } from './pose';
import type { StyledRun } from './runs';
import { DEFAULT_TEXT_STYLE } from './textStyle';

function scaled(v: ScreenLength, k: number): ScreenLength {
  return typeof v === 'number' ? v * k : { px: v.px * k };
}

/**
 * `pose` with its `fit` settled: every size and spacing it states, the
 * style's and each run's, scaled by the factor `fit` resolves to at view
 * `scale`, and `fit` dropped. It lays out into the lines `pose` does. For a
 * reader that writes the sizes out rather than laying the text out, such as
 * an export; a pose with nothing to shrink comes back without `fit`, as is.
 */
export function fittedTextPose(pose: TextPose, scale = 1): TextPose {
  const { fit: _, ...rest } = pose;
  const k = textFitScale(pose, scale);
  if (k === 1) return rest;
  const style = rest.style ?? {};
  const runs = rest.runs?.map((r): StyledRun => ({
    ...r,
    ...(r.fontSize !== undefined ? { fontSize: scaled(r.fontSize, k) } : {}),
    ...(r.letterSpacing !== undefined ? { letterSpacing: scaled(r.letterSpacing, k) } : {}),
  }));
  return {
    ...rest,
    style: {
      ...style,
      fontSize: scaled(style.fontSize ?? DEFAULT_TEXT_STYLE.fontSize, k),
      ...(style.letterSpacing !== undefined ? { letterSpacing: scaled(style.letterSpacing, k) } : {}),
    },
    ...(runs ? { runs } : {}),
  };
}
