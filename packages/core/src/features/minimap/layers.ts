/**
 * The minimap's chrome: the main camera's visible rect, drawn in the minimap,
 * and the linked crosshair, drawn in every view the pointer is not over.
 */
import type { RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '../../renderer/DrawCommand';
import type { ViewApi } from 'interactions/actions/depSchema';
import type { PointerWorldPos } from 'features/pointer/PointerContext';
import type { IndicatorStyle } from '../../canvas/minimapMath';

/** What a layer's `data` carries for this feature: the view it draws for. */
function viewIdOf(data: unknown): string | null {
  return (data as { viewId?: string | null } | null)?.viewId ?? null;
}

/**
 * The main camera's visible world rect, painted only in view `viewId`. Its
 * stroke and dash are screen pixels whatever the minimap's scale.
 */
export function createIndicatorLayer(opts: {
  viewId: string;
  root: () => ViewApi | undefined;
  style?: IndicatorStyle;
}): RenderLayer<unknown> {
  const { viewId, root, style = {} } = opts;
  return {
    id: `${viewId}.indicator`,
    label: 'Minimap indicator',
    draw: (data, view: View): DrawCommand[] => {
      if (viewIdOf(data) !== viewId) return [];
      const r = root();
      const size = r?.hostSize?.();
      if (!r || !size) return [];
      const v = r.get();
      const px = 1 / view.scale.x;
      return [{
        kind: 'path',
        path: { kind: 'rect', x: v.x, y: v.y, width: size.width / v.scale.x, height: size.height / v.scale.y },
        stroke: {
          paint: { fill: 'solid', color: style.stroke ?? '#ffffff' },
          width: (style.width ?? 1) * px,
          dash: (style.dash ?? [2, 3]).map((d) => d * px),
        },
      }];
    },
  };
}

/** Screen-pixel geometry of the crosshair: arm length, the gap at its center,
 *  and line thickness. */
const ARM = 9;
const GAP = 3;
const THICK = 1.5;

/**
 * A crosshair at the pointer's world point, in every view the pointer is not
 * over — the other side of a linked cursor. A fixed screen size in every view.
 */
export function createLinkedCursorLayer(opts: {
  id: string;
  pointer: () => PointerWorldPos;
  color: () => string;
}): RenderLayer<unknown> {
  const { id, pointer, color } = opts;
  return {
    id,
    label: 'Linked cursor',
    draw: (data, view: View): DrawCommand[] => {
      const p = pointer();
      if (!p || p.viewId === viewIdOf(data)) return [];
      const k = 1 / view.scale.x;
      const arm = ARM * k, gap = GAP * k, t = THICK * k;
      const { worldX: x, worldY: y } = p;
      const fill = { fill: 'solid' as const, color: color() };
      const bar = (bx: number, by: number, w: number, h: number): DrawCommand => ({
        kind: 'path', path: { kind: 'rect', x: bx, y: by, width: w, height: h }, fill,
      });
      return [
        bar(x - gap - arm, y - t / 2, arm, t),
        bar(x + gap, y - t / 2, arm, t),
        bar(x - t / 2, y - gap - arm, t, arm),
        bar(x - t / 2, y + gap, t, arm),
      ];
    },
  };
}
