import { RAD_TO_DEG, wrapPositive, type ArcTrackSpec } from '@weasel-js/geom';
import type { Box } from '../Slider/useBoxes';
import type { AlongArc, ArcSpan } from './alongContext';

/** The arc spec for `arc` laid in `box`: inscribed circle less `inset`, centered, unless overridden. */
export function arcInBox(arc: AlongArc, box: Box): ArcTrackSpec {
  const inscribed = Math.min(box.width, box.height) / 2 - (arc.inset ?? 0);
  const radius = arc.radius ?? Math.max(0, inscribed);
  const spec = { center: arc.center ?? { x: box.width / 2, y: box.height / 2 }, radius, direction: arc.direction };
  if (arc.span === undefined) return { ...spec, start: arc.start, end: arc.end };
  const half = (spanDegrees(arc.span, radius) / 2) * (arc.direction === 'ccw' ? -1 : 1);
  return { ...spec, start: wrapPositive(arc.at - half, 360), end: wrapPositive(arc.at + half, 360) };
}

/** Equal ends make an arc a whole circle, so a span of nothing keeps its ends this far apart. */
const LEAST = 1e-6;

/** Degrees of turn `span` reaches on a circle of `radius`, capped at a whole turn and floored at {@link LEAST}. */
export function spanDegrees(span: ArcSpan, radius: number): number {
  const n = Number.parseFloat(span);
  const deg = !(n > 0) ? 0 : span.endsWith('px') ? (radius > 0 ? (n / radius) * RAD_TO_DEG : 0) : n;
  return Math.min(360, Math.max(LEAST, deg));
}
