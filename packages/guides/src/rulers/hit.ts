import { viewWorldToScreen, type LayerHit, type RenderLayer } from '@weasel-js/core';

/** Which part of the rulers a press landed on. */
export type RulerPart = 'top' | 'left' | 'corner';

/** What a press on the rulers carries to the drag it starts. */
export interface RulerHit {
  part: RulerPart;
}

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

/**
 * The rulers' input layer: it draws nothing — a ruler is drawn as chrome over
 * the canvas — and claims every press on the strips the rulers cover, so a
 * drag there places a guide rather than reaching the tool, and the corner box
 * swallows its presses.
 */
export function rulersHitLayer(id: string, size: number): RenderLayer<unknown> {
  return {
    id,
    label: 'Rulers',
    space: 'screen',
    draw: () => [],
    hitTest: (wx, wy, _data, view): LayerHit<RulerHit> | null => {
      const s = viewWorldToScreen(view, { x: wx, y: wy });
      const part = rulerPartAt(s.x, s.y, size);
      if (part === null) return null;
      return { initialScratch: { part }, strength: 'exclusive', claimedKinds: ['pointer'], cursor: CURSOR[part] };
    },
  };
}
