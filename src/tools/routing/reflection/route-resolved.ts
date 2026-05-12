// src/tools/routing/reflection/route-resolved.ts
import type { HitResult } from '../hitResult';
import type { ModifierKey } from '../modifiers';

/** Phase the route was resolved against. Mirrors the spec's two-phase
 *  vocabulary — `initial` (idle, scratch null) or `engaged` (mid-gesture). */
export type RoutePhase = 'initial' | 'engaged';

/** Gesture channel the route fired on. */
export type RouteGesture = 'click' | 'dblTap' | 'drag' | 'wheel' | 'keyDown' | 'keyUp';

/** Snapshot of one route resolution, emitted by the factory on each
 *  successful lookup. Captured by the dispatcher as the "last resolved
 *  route" for debug-overlay consumers. */
export interface RouteResolvedInfo {
  toolId: string;
  phase: RoutePhase;
  gesture: RouteGesture;
  /** Route-table key that matched (post-precedence). E.g. 'rect:selected',
   *  '*:selected', 'rect', '*', 'empty'. For function-form `drag` (no
   *  table), this is '*'. For keyDown/keyUp, it's the key name ('Escape',
   *  'Enter', etc.). */
  matchedKey: string;
  modifiers: ModifierKey;
  /** The full HitResult at resolution time (snapshot — safe to read). */
  target: HitResult;
  /** Monotonic timestamp (ms since page load via performance.now()).
   *  Used for "resolved Nms ago" displays. */
  timestamp: number;
}

/** Render-friendly one-line string. Used by ToolDebugOverlay; exported
 *  so non-React consumers can format the same way. */
export function formatRouteResolved(info: RouteResolvedInfo): string {
  const mod = info.modifiers === 'default' ? '' : ` mods=${info.modifiers}`;
  return `${info.toolId} [${info.phase}] ${info.gesture} → ${info.matchedKey}${mod}`;
}
