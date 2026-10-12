import type { Fill, Paint } from '@weasel-js/core';

/** `fill` with its paint put through `f`. The same object when it carries no
 *  paint or `f` hands the paint back unchanged. */
export function mapFillPaint(fill: Fill, f: (paint: Paint) => Paint): Fill {
  if (!fill.paint) return fill;
  const paint = f(fill.paint);
  return paint === fill.paint ? fill : { ...fill, paint };
}
