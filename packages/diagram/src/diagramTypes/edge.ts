import type { Stroke } from '@weasel-js/core';
import { themeEdgeStroke } from '../theme/resolve';
import type { DiagramTheme } from '../theme/types';
import type { DiagramType } from './types';

/** The stroke a new connector in a diagram of `type` starts with: the theme's, with each end marker
 *  the type sets put over it, and its dash. A marker set to `null` draws no marker on that end. */
export function diagramTypeEdgeStroke(theme: DiagramTheme, type: DiagramType): Stroke {
  const { markerStart, markerEnd, ...rest } = themeEdgeStroke(theme);
  const start = type.edge?.markerStart === undefined ? markerStart : type.edge.markerStart;
  const end = type.edge?.markerEnd === undefined ? markerEnd : type.edge.markerEnd;
  return {
    ...rest, ...(start ? { markerStart: start } : {}), ...(end ? { markerEnd: end } : {}),
    ...(type.edge?.dash !== undefined ? { dash: [...type.edge.dash] } : {}),
  };
}
