import { strokeWith, type InsertPaint, type PathFillRule, useLatest } from '@weasel-js/core';
import { useMemo } from 'react';
import type { ActivePaint } from './ActiveSwatches';
import { usePref } from './prefs';
import { useColorContext } from './tools/colorContext';

const NEW_STROKE_WIDTH = 2;

/** Open shapes: nothing to fill, so a new one is its stroke alone. */
const STROKE_ONLY = new Set(['line', 'pencil']);

/**
 * The paint of a newly drawn shape: the swatches' active fill and stroke, and
 * the fill rule Preferences names, each read when the shape is inserted.
 */
export function activeInsertPaint(
  active: () => { fill: ActivePaint; stroke: ActivePaint },
  fillRule: () => PathFillRule,
): InsertPaint {
  return (kind) => {
    const { fill, stroke } = active();
    return {
      fill: STROKE_ONLY.has(kind) || fill === null ? null : { paint: fill },
      stroke: stroke === null ? null : strokeWith(stroke, NEW_STROKE_WIDTH),
      fillRule: fillRule(),
    };
  };
}

/** {@link activeInsertPaint} over the live swatches and the fill-rule preference. */
export function useInsertPaint(): InsertPaint {
  const colorsRef = useLatest(useColorContext());
  const [pathFillRule] = usePref('drawing.pathFillRule');
  const fillRuleRef = useLatest(pathFillRule);
  return useMemo(
    () => activeInsertPaint(() => colorsRef.current, () => (fillRuleRef.current === 'evenodd' ? 'evenodd' : 'nonzero')),
    [colorsRef, fillRuleRef],
  );
}
