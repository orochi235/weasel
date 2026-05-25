/**
 * `areaSelectAction` — ongoing Action descriptor for marquee area selection (Phase 11).
 *
 * ## Status: REAL
 *
 * Implements the marquee selection logic from `useAreaSelect`:
 *   - `start`: records the drag start world point and shift state.
 *   - `onMove`: tracks the current drag corner (no scene writes).
 *   - `onEnd('commit')`: derives the marquee bounds from start + current;
 *     calls `deps.areaSelect.hitTestArea(bounds)` to find overlapping nodes;
 *     calls `deps.areaSelect.setSelection(ids)` to update selection (extending
 *     with shift held). This is a **transient** write (no undo entry) matching
 *     `useAreaSelect`'s `defaultTransient: true` convention from
 *     `selectFromMarquee`.
 *   - `onEnd('cancel')`: no-op.
 *
 * ## Dependencies
 *
 * Requires `areaSelect` dep from DepSchema (Phase 11 addition):
 *   `{ hitTestArea(bounds): NodeId[], getSelection(): NodeId[], setSelection(ids): void }`
 *
 * `<SceneCanvas>` / `<StandardActionsRegistrar>` should source this dep by
 * iterating scene nodes and checking AABB overlap. The dep is intentionally
 * simple — consumers override it for custom hit-testing (contain-mode,
 * layer-aware filtering, etc.).
 *
 * ## What this does NOT wire (vs `useAreaSelect`)
 *
 * - Live marquee overlay rendering — deferred to Phase 7 overlay surface.
 * - `AreaSelectBehavior` pipeline — omitted; only the default replace/extend
 *   semantics are implemented.
 * - Debug sink recording — not available in the descriptor model.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, OngoingOverlay } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { AreaSelectDep } from '../depSchema';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface AreaSelectScratch {
  dep: AreaSelectDep;
  startX: number;
  startY: number;
  shiftHeld: boolean;
  currentX: number;
  currentY: number;
  /** Cleared once `onEnd` runs so subsequent `overlay()` calls report no
   *  in-flight marquee (the dispatcher releases the handle after onEnd so
   *  this is belt-and-suspenders for any consumer that retains a handle). */
  open: boolean;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `areaSelect` Action.
 *
 * Requires dep-schema entry: `areaSelect`.
 *
 * The invoker implements replace/extend marquee selection via the `areaSelect`
 * dep. Hit-testing and selection writes are delegated to the dep; the invoker
 * contains only the bounds-derivation and shift-extend logic.
 *
 * @see useAreaSelect — the React hook this descriptor mirrors for the default case.
 */
export const areaSelectAction: Action & { requires: string[] } = {
  id: 'areaSelect',
  label: 'Area Select',
  defaultBinding: { kind: 'drag' },
  eligible: { capability: 'creates-selection' },
  requires: ['areaSelect'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const dep = ctx.deps.areaSelect as AreaSelectDep | undefined;
      if (!dep) return {};

      // Decline on anchor / control-handle affordances: the select tool's
      // active-scope binding for this action is `{ kind: 'drag', target: 'empty' }`,
      // which matches whenever `bodyTarget === 'empty'` — including drags
      // where an anchor was hit on top of empty body. Without this opt-out
      // areaSelect would beat editAnchors via scope priority. The
      // dispatcher's empty-handle fallthrough then forwards the gesture.
      const affordanceKind = ctx.drag?.affordance?.kind;
      if (
        typeof affordanceKind === 'string'
        && /^(anchor|controlIn|controlOut):/.test(affordanceKind)
      ) {
        return {};
      }

      // Drag start is the world point at the moment start() is called.
      const scratch: AreaSelectScratch = {
        dep,
        startX: ctx.world.x,
        startY: ctx.world.y,
        shiftHeld: ctx.modifiers.shift,
        currentX: ctx.world.x,
        currentY: ctx.world.y,
        open: true,
      };

      return {
        kind: 'marquee',
        onMove(moveCtx: InvocationCtx): void {
          scratch.currentX = moveCtx.world.x;
          scratch.currentY = moveCtx.world.y;
        },
        overlay(): OngoingOverlay | null {
          if (!scratch.open) return null;
          return {
            kind: 'marquee',
            start: { x: scratch.startX, y: scratch.startY },
            current: { x: scratch.currentX, y: scratch.currentY },
            shiftHeld: scratch.shiftHeld,
          };
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          scratch.open = false;
          if (reason === 'cancel') return;

          const { dep: d, startX, startY, currentX, currentY, shiftHeld } = scratch;

          // Derive the marquee AABB from the two world-space corners.
          const x = Math.min(startX, currentX);
          const y = Math.min(startY, currentY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);

          // Zero-size marquee (click without drag) → clear selection (or no-op with shift).
          if (width === 0 || height === 0) {
            if (!shiftHeld) d.setSelection([]);
            return;
          }

          const hits = d.hitTestArea({ x, y, width, height }) as NodeId[];

          if (shiftHeld) {
            const current = d.getSelection();
            // Extend: merge current + hits (deduplicated).
            const merged = [...current];
            for (const id of hits) {
              if (!merged.includes(id)) merged.push(id);
            }
            d.setSelection(merged);
          } else {
            d.setSelection(hits);
          }
        },
      };
    },
  },
  /**
   * Always enabled at the dispatcher level. The dispatcher's
   * specificity-fallthrough loop treats anything `!== true` as "skip this
   * match" — returning a disabled reason would let lower-specificity
   * ambient bindings win. The invoker has no preconditions to guard.
   */
  enabled: () => true,
};
