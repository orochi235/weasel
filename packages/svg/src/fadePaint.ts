/**
 * Scale a paint's opacity by `k`: how an element or group `opacity` reaches
 * leaves whose data has no opacity of its own. Where a fill and a stroke
 * overlap this is not SVG's group compositing, which flattens first.
 */
import type { Paint, Stroke, StyledRun } from '@weasel-js/core';
import { mapFillPaint } from './fillPaint';

export function fadeFill(fill: Paint, k: number): Paint {
  return k === 1 ? fill : { ...fill, opacity: (fill.opacity ?? 1) * k };
}

export function fadeStroke(stroke: Stroke, k: number): Stroke {
  return k === 1 || !stroke.paint ? stroke : { ...stroke, paint: fadeFill(stroke.paint, k) };
}

export function fadeRun(run: StyledRun, k: number): StyledRun {
  if (k === 1 || (!run.fill && !run.stroke)) return run;
  return {
    ...run,
    ...(run.fill ? { fill: mapFillPaint(run.fill, (p) => fadeFill(p, k)) } : {}),
    ...(run.stroke ? { stroke: fadeStroke(run.stroke, k) } : {}),
  };
}
