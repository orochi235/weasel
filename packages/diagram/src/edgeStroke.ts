import type { Stroke } from '@weasel-js/core';
import { EDGE_STROKE_WIDTH, type EdgeStyle } from './dataTypes';

/** The stroke a connector drawn in `style` paints: no start marker and an arrow at the end unless
 *  it says otherwise, `null` for none, and {@link EDGE_STROKE_WIDTH} unless it sets a width. */
export function edgeStrokeOf(style: EdgeStyle): Stroke {
  const markerStart = style.markerStart ?? null;
  const markerEnd = style.markerEnd === undefined ? 'arrow' : style.markerEnd;
  return {
    paint: { color: style.stroke },
    width: style.width ?? EDGE_STROKE_WIDTH,
    ...(style.dash ? { dash: style.dash } : {}),
    ...(style.trim !== undefined ? { trim: style.trim } : {}),
    ...(markerStart !== null ? { markerStart } : {}),
    ...(markerEnd !== null ? { markerEnd } : {}),
  };
}
