import { viewWorldToScreen, type LayerHit, type RenderLayer, type View } from '@weasel-js/core';
import type { Guide } from '../guides/types';

/** Which part of the rulers a press landed on. */
export type RulerPart = 'top' | 'left' | 'corner';

/** What a press on the rulers, or on a guide placed off them, carries to the
 *  drag it starts. */
export type RulerHit = { part: RulerPart } | { part: 'guide'; guide: Guide };

/** Screen px either side of a guide that a press picks it within. */
export const GUIDE_HIT_PX = 4;

/** The part of the rulers at canvas point (`x`, `y`) in CSS px, for rulers
 *  `size` px thick along the top and left edges; `null` off them. */
export function rulerPartAt(x: number, y: number, size: number): RulerPart | null {
  if (x < 0 || y < 0) return null;
  if (x < size && y < size) return 'corner';
  if (y < size) return 'top';
  if (x < size) return 'left';
  return null;
}

/** The guide a drag off `part` places: the top ruler's runs across the
 *  canvas, at a world y; the left ruler's runs down it, at a world x. */
export const guideAxisOf = (part: 'top' | 'left'): 'x' | 'y' => (part === 'top' ? 'y' : 'x');

const CURSOR: Record<RulerPart, string> = { top: 'row-resize', left: 'col-resize', corner: 'default' };

/** The guide whose line passes within `GUIDE_HIT_PX` of screen point `s`, nearest first. */
function guideAt(guides: readonly Guide[], view: View, s: { x: number; y: number }): Guide | null {
  let best: Guide | null = null;
  let bestPx = GUIDE_HIT_PX;
  for (const g of guides) {
    const on = viewWorldToScreen(view, { x: g.offset, y: g.offset });
    const px = Math.abs(g.axis === 'x' ? s.x - on.x : s.y - on.y);
    if (px <= bestPx) { best = g; bestPx = px; }
  }
  return best;
}

/**
 * The rulers' input layer: it draws nothing — a ruler is drawn as chrome over
 * the canvas — and claims every press on the strips the rulers cover, so a
 * drag there places a guide rather than reaching the tool, and the corner box
 * swallows its presses. Off the rulers it claims a press on one of
 * `getGuides`, so a drag moves that guide.
 */
export function rulersHitLayer(id: string, size: number, getGuides: () => readonly Guide[]): RenderLayer<unknown> {
  return {
    id,
    label: 'Rulers',
    space: 'screen',
    draw: () => [],
    hitTest: (wx, wy, _data, view): LayerHit<RulerHit> | null => {
      const s = viewWorldToScreen(view, { x: wx, y: wy });
      const part = rulerPartAt(s.x, s.y, size);
      if (part !== null) return { initialScratch: { part }, strength: 'exclusive', claimedKinds: ['pointer'], cursor: CURSOR[part] };
      const guide = guideAt(getGuides(), view, s);
      if (guide === null) return null;
      return {
        initialScratch: { part: 'guide', guide }, strength: 'exclusive', claimedKinds: ['pointer'],
        cursor: guide.axis === 'y' ? 'row-resize' : 'col-resize',
      };
    },
  };
}
