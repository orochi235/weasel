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
 *  line thickness, and the dark halo that keeps it legible over any content. */
const ARM = 9;
const GAP = 3;
const THICK = 2;
const HALO = 1;
const HALO_COLOR = 'rgba(0, 0, 0, 0.6)';

/**
 * A crosshair at the pointer's world point, in each of `views` the pointer is
 * not over — the other side of a linked cursor. A fixed screen size in every
 * view. `views` omitted paints in every view.
 */
export function createLinkedCursorLayer(opts: {
  id: string;
  pointer: () => PointerWorldPos;
  color: () => string;
  views?: readonly (string | null)[];
}): RenderLayer<unknown> {
  const { id, pointer, color, views } = opts;
  return {
    id,
    label: 'Linked cursor',
    draw: (data, view: View): DrawCommand[] => {
      const p = pointer();
      const here = viewIdOf(data);
      if (!p || p.viewId === here || (views && !views.includes(here))) return [];
      const k = 1 / view.scale.x;
      const arm = ARM * k, gap = GAP * k, t = THICK * k, h = HALO * k;
      const { worldX: x, worldY: y } = p;
      const bars: [number, number, number, number][] = [
        [x - gap - arm, y - t / 2, arm, t],
        [x + gap, y - t / 2, arm, t],
        [x - t / 2, y - gap - arm, t, arm],
        [x - t / 2, y + gap, t, arm],
      ];
      const rect = (bx: number, by: number, w: number, ht: number, c: string): DrawCommand => ({
        kind: 'path',
        path: { kind: 'rect', x: bx, y: by, width: w, height: ht },
        fill: { fill: 'solid', color: c },
      });
      const accent = color();
      return [
        ...bars.map(([bx, by, w, ht]) => rect(bx - h, by - h, w + 2 * h, ht + 2 * h, HALO_COLOR)),
        ...bars.map(([bx, by, w, ht]) => rect(bx, by, w, ht, accent)),
      ];
    },
  };
}
