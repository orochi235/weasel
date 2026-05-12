import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../renderer';
import type { ChromeState } from 'core/selection/chromeState';
import type { Affordance, AffordanceBinding } from './types';

/**
 * @experimental
 * Bundle a list of Affordances into a single RenderLayer. The layer's
 * `draw` iterates affordances in array order (first → last = bottom →
 * top in paint stacking). Its `hitTest` walks the same list in REVERSE
 * order (last → first = top → bottom) and returns the first non-null
 * result.
 *
 * Affordances that omit `hitTest` are skipped during the hit walk
 * (they're decorative, not interactive).
 */
export function composeAffordanceLayer(
  id: string,
  label: string,
  affordances: readonly Affordance[],
): RenderLayer<ChromeState> & {
  hitTest(wx: number, wy: number, state: ChromeState, view: { x: number; y: number; scale: number }, dims: { width: number; height: number }): AffordanceBinding | null;
} {
  return {
    id,
    label,
    space: 'screen',
    draw: (state, view, _dims): DrawCommand[] => {
      const out: DrawCommand[] = [];
      for (const a of affordances) {
        for (const cmd of a.render(state, view)) out.push(cmd);
      }
      return out;
    },
    hitTest: (wx, wy, state, view, _dims): AffordanceBinding | null => {
      for (let i = affordances.length - 1; i >= 0; i--) {
        const a = affordances[i];
        if (!a.hitTest) continue;
        const r = a.hitTest(wx, wy, state, view);
        if (r !== null) return r;
      }
      return null;
    },
  };
}
