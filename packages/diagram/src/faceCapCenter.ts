import { faceMetricsFor, type FaceMetrics } from '@weasel-js/font';
import type { RowTextStyle } from './body';
import { FALLBACK_LINE, capCenterFrom, weightOf } from './rowMeasure';

/** `capCenter` for `style`, from its registered face's metrics, or `undefined` while the face is
 *  unregistered, still loading, or states no cap height. */
export function faceCapCenter(
  style: RowTextStyle,
  metricsOf: (family: string, weight: number, style: 'normal' | 'italic') => FaceMetrics | undefined = faceMetricsFor,
): number | undefined {
  if (style.fontFamily === undefined) return undefined;
  const m = metricsOf(style.fontFamily, weightOf(style) ?? 400, style.italic === true ? 'italic' : 'normal');
  if (m?.ascent === undefined || m.descent === undefined || m.capHeight === undefined) return undefined;
  return capCenterFrom({ ascent: m.ascent, descent: m.descent, capHeight: m.capHeight }, style.fontSize ?? FALLBACK_LINE);
}
