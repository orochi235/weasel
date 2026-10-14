/** The corner widgets of the path in edit mode, hit as `corner:N`. */

import type { CursorSpec } from '@weasel-js/cursor';
import type { PolygonPath } from '@weasel-js/geom';
import type { ChromeState } from 'core/selection/chromeState';
import { cornerCutMiddle, cornerWidgetFrames, CORNER_WIDGET_STANDOFF_PX } from 'features/paths/cornerWidgets';
import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';

/** One region per corner widget of the path `edited` answers, where the
 *  overlay paints it: the middle of the cut, pushed in on screen. */
export function createPathCornerAffordance(
  id: string,
  edited: (state: ChromeState) => { id: string; path: PolygonPath } | null,
  hitRadius: number,
  cursor: CursorSpec,
): Affordance {
  return {
    id,
    regions(state) {
      const target = edited(state);
      if (!target) return [];
      return cornerWidgetFrames(target.path).map((f): AffordanceRegion => {
        const mid = cornerCutMiddle(f);
        return {
          id: `${target.id}:corner:${f.index}`,
          targetId: null,
          shape: {
            kind: 'point', x: mid.x, y: mid.y, hitRadiusPx: hitRadius,
            standoff: { px: CORNER_WIDGET_STANDOFF_PX, normal: f.bisector },
          },
          hitKind: `corner:${f.index}`,
          cursor,
          bind: (): AffordanceBinding => ({
            initialScratch: { targetId: target.id, anchorIndex: f.index, part: 'corner' },
          }),
        };
      });
    },
  };
}
