import type { NodeId } from '../scene/types';
import type { ModifierState } from '../../interactions/gestures/types';

/** AABB used for selection chrome bounds. Mirrors `Bounds` in
 *  `src/core/adapters/types` but inlined here to avoid an import cycle. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Read-only state that affordances consult on every render and hit-test
 * call. Built once per Canvas render via `buildChromeState`; affordances
 * must not cache it across calls.
 */
export interface ChromeState {
  /** Currently selected ids. Live; reflects useSelection's React state. */
  readonly selection: readonly NodeId[];
  /** True when the canvas is in multi-mode AND >= 2 ids are selected. */
  readonly multiActive: boolean;
  /** Bounds for any selection member id. Honors active-tool overlay state
   *  (move/resize/rotate ghosts → ghost bounds; otherwise → committed
   *  pose bounds). Returns null for unknown ids or ids whose bounds aren't
   *  computable. */
  boundsOf(id: string): Bounds | null;
  /** Multi-union AABB when `multiActive`. Computed lazily from `boundsOf`
   *  over every selected id; null otherwise. */
  readonly unionBounds: Bounds | null;
  /** Active modifier state at the moment of the call. */
  readonly modifiers: ModifierState;
}

export interface BuildChromeStateArgs {
  selection: readonly NodeId[];
  multiActive: boolean;
  effectiveBoundsOf: (id: string) => Bounds | null;
  modifiers: ModifierState;
}

export function buildChromeState(args: BuildChromeStateArgs): ChromeState {
  const { selection, multiActive, effectiveBoundsOf, modifiers } = args;
  let cached: { value: Bounds | null; computed: boolean } = { value: null, computed: false };
  return {
    selection,
    multiActive,
    boundsOf: effectiveBoundsOf,
    modifiers,
    get unionBounds() {
      if (cached.computed) return cached.value;
      cached.computed = true;
      if (!multiActive) {
        cached.value = null;
        return null;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let any = false;
      for (const id of selection) {
        const b = effectiveBoundsOf(id);
        if (!b) continue;
        any = true;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      }
      cached.value = any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
      return cached.value;
    },
  };
}
