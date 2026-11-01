import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle, OngoingOverlay } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { AreaSelectDep, ViewApi } from '../depSchema';
import { hitTargets, selectionFromHits } from '../hitSelection';

interface AreaSelectScratch {
  dep: AreaSelectDep;
  /** The view the marquee started in: what it does not paint is not taken. */
  view: ViewApi | undefined;
  startX: number;
  startY: number;
  shiftHeld: boolean;
  currentX: number;
  currentY: number;
  /** Cleared once `onEnd` runs, so a consumer that retains the handle gets
   *  no marquee from `overlay()`. */
  open: boolean;
}

/**
 * Marquee selection: replace, or extend with shift held. Hit-testing and
 * selection writes are delegated to the `areaSelect` dep, each hit taken at
 * the depth a click selects (`AreaSelectDep.targetOf`), and the selection
 * write makes no undo entry.
 */
export const areaSelectAction: Action & { requires: string[] } = {
  id: 'areaSelect',
  label: 'Area Select',
  activeCursor: 'crosshair',
  eligible: { capability: 'creates-selection' },
  requires: ['areaSelect', 'editAnchors', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const dep = ctx.deps.areaSelect;
      if (!dep) return {};

      // Decline on anchor / control-handle affordances: the select tool's
      // `{ kind: 'drag', target: 'empty' }` binding also matches an anchor hit
      // on top of empty body, and would beat editAnchors via scope priority.
      const affordanceKind = ctx.drag?.affordance?.kind;
      if (
        typeof affordanceKind === 'string'
        && /^(anchor|controlIn|controlOut):/.test(affordanceKind)
      ) {
        return {};
      }

      // Decline while a path is in anchor-edit mode, where an empty-canvas
      // drag is `marqueeAnchorsAction`'s. Capability eligibility filters this
      // only for consumers that wired a mode registry; without one
      // areaSelect's active scope would beat marqueeAnchors' ambient scope.
      const editAnchors = ctx.deps.editAnchors;
      if (editAnchors?.editingId) return {};

      const scratch: AreaSelectScratch = {
        dep,
        view: ctx.deps.view,
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

          const { dep: d, view, startX, startY, currentX, currentY, shiftHeld } = scratch;

          const x = Math.min(startX, currentX);
          const y = Math.min(startY, currentY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);

          // Zero-size marquee (click without drag) → clear selection (or no-op with shift).
          if (width === 0 || height === 0) {
            if (!shiftHeld) d.setSelection([]);
            return;
          }

          const hits = hitTargets(d.hitTestArea({ x, y, width, height }, view), d.targetOf) as NodeId[];

          d.setSelection(selectionFromHits(d.getSelection(), hits, shiftHeld));
        },
      };
    },
  },
  /** Always enabled: the dispatcher treats anything `!== true` as "skip this
   *  match", so a disabled reason would let lower-specificity ambient bindings win. */
  enabled: () => true,
};
