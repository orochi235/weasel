import { polylineFromPoints, type Path } from '@weasel-js/core';
import { recordedLayout } from './bodyRelayout';
import type { Bounds } from './outline';
import type { DiagramNode } from './types';

/** The rule each divider row of a built body draws when the body is at `box`, laid out from the row
 *  heights its trait records. Empty for a body with no dividers. */
export function bodyRules(trait: DiagramNode, box: Bounds): Path[] {
  if (trait.body?.dividers === undefined) return [];
  return (recordedLayout(trait, box) ?? []).filter((b) => b.row.kind === 'divider').map((b) => {
    const y = b.y + b.height / 2;
    return polylineFromPoints([{ x: b.x, y }, { x: b.x + b.width, y }]);
  });
}
