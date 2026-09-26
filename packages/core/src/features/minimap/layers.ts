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
/** The halo's color: dark enough to separate the accent from any content. */
export const CROSSHAIR_HALO = 'rgba(0, 0, 0, 0.6)';

/** An axis-aligned rect, `{ x, y, w, h }`. */
export interface CrosshairRect { x: number; y: number; w: number; h: number }

/**
 * The linked crosshair at (`x`, `y`) as rects in the caller's units, where one
 * screen pixel is `unitsPerPx` of them: four halo rects to paint first, then
 * four bars. A painter with no weasel renderer — a 2D canvas — draws the same
 * crosshair from these.
 */
export function crosshairRects(
  x: number, y: number, unitsPerPx: number,
): { halo: CrosshairRect[]; bars: CrosshairRect[] } {
  const k = unitsPerPx;
  const arm = ARM * k, gap = GAP * k, t = THICK * k, h = HALO * k;
  const bars: CrosshairRect[] = [
    { x: x - gap - arm, y: y - t / 2, w: arm, h: t },
    { x: x + gap, y: y - t / 2, w: arm, h: t },
    { x: x - t / 2, y: y - gap - arm, w: t, h: arm },
    { x: x - t / 2, y: y + gap, w: t, h: arm },
  ];
  const halo = bars.map((b) => ({ x: b.x - h, y: b.y - h, w: b.w + 2 * h, h: b.h + 2 * h }));
  return { halo, bars };
}

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
      const { halo, bars } = crosshairRects(p.worldX, p.worldY, 1 / view.scale.x);
      const rect = (r: CrosshairRect, c: string): DrawCommand => ({
        kind: 'path',
        path: { kind: 'rect', x: r.x, y: r.y, width: r.w, height: r.h },
        fill: { fill: 'solid', color: c },
      });
      const accent = color();
      return [
        ...halo.map((r) => rect(r, CROSSHAIR_HALO)),
        ...bars.map((r) => rect(r, accent)),
      ];
    },
  };
}
