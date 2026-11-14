import { type Action, ActionDisabledReason, ANY_MODS, type ImmediateParams, type WorldPoint } from '@weasel-js/core';
import { OCTANT_SPLINE_MAX_ANCHORS, OCTANT_SPLINE_MIN_ANCHORS } from '@weasel-js/ui/components/Badge/geometry';
import type { SplineAnchor, SplineMode } from './splineAnchors';
import {
  dragEnd, dragInterior, insertionAt, normalAxisAt, polarPoint, projectOntoAxis, wheelWeight, type Point,
} from './splineGeometry';

/** How near a dot, in editor units, a press has to land to take it. */
const HIT_RADIUS = 3;

/** What the editor's actions read and write, current on every event. */
export interface SplineEditorInput {
  mode: SplineMode;
  anchors: readonly SplineAnchor[];
  /** The curve as drawn, which a Shift-drag's normal is taken from. */
  samples: readonly Point[];
  /** Anchor `idx` moved to `anchor`, as a drag passes through. */
  draft(idx: number, anchor: SplineAnchor): void;
  /** Anchor `idx` settled at `anchor`: a drag's end, or a single edit. */
  commit(idx: number, anchor: SplineAnchor): void;
  remove(idx: number): void;
  insert(s: number, r: number): void;
  /** The anchor a drag holds, or `null` once it lets go. */
  setActive(idx: number | null): void;
}

/** The dot under `at`, nearest first, or -1. */
export function anchorAt(input: Pick<SplineEditorInput, 'mode' | 'anchors'>, at: WorldPoint | undefined): number {
  if (!at) return -1;
  let best = -1;
  let bestD = HIT_RADIUS;
  input.anchors.forEach((anchor, idx) => {
    const p = polarPoint(input.mode, anchor.s, anchor.r);
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d <= bestD) {
      best = idx;
      bestD = d;
    }
  });
  return best;
}

const pinned = (input: Pick<SplineEditorInput, 'anchors'>, idx: number): boolean => idx === 0 || idx === input.anchors.length - 1;

const on = (ok: boolean) => (ok ? true : ActionDisabledReason.NotApplicable);

/**
 * The curve editor's input as actions on its own dispatcher, whose world is the editor's view box: drag a dot to
 * move it (Shift locks it to the curve's normal), Alt-click to insert one, right-click an interior dot to remove
 * it, and scroll over a dot to change its weight. A drag drafts every move and commits once, as one step.
 */
export function splineEditorActions(input: { readonly current: SplineEditorInput }): Action[] {
  const move: Action = {
    id: 'badge-spline.move',
    label: 'Move anchor',
    defaultBinding: { kind: 'drag', mods: ANY_MODS },
    enabled: (_deps, at) => on(anchorAt(input.current, at) >= 0),
    invoker: {
      timing: 'ongoing',
      start(ctx) {
        const now = input.current;
        const idx = anchorAt(now, ctx.drag?.start ?? ctx.world);
        if (idx < 0) return {};
        const original = now.anchors[idx]!;
        const end = pinned(now, idx) ? (idx === 0 ? 'first' : 'last') : null;
        const axis = ctx.modifiers.shift && !end
          ? normalAxisAt(now.samples, polarPoint(now.mode, original.s, original.r))
          : null;
        let last = original;
        now.setActive(idx);
        return {
          kind: 'anchor-move',
          onMove(step) {
            const live = input.current;
            last = end
              ? dragEnd(live.mode, end, step.world, original.w)
              : dragInterior(live.mode, live.anchors, idx, axis ? projectOntoAxis(axis, step.world) : step.world);
            live.draft(idx, last);
          },
          onEnd(_end, how) {
            const live = input.current;
            live.setActive(null);
            live.commit(idx, how === 'commit' ? last : original);
          },
        };
      },
    },
  };

  const insert: Action = {
    id: 'badge-spline.insert',
    label: 'Insert anchor',
    defaultBinding: { kind: 'click', mods: { alt: true } },
    enabled: () => on(input.current.anchors.length < OCTANT_SPLINE_MAX_ANCHORS),
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        const { world } = (params ?? {}) as ImmediateParams;
        if (!world) return 'pass';
        const at = insertionAt(input.current.mode, world);
        input.current.insert(at.s, at.r);
      },
    },
  };

  const remove: Action = {
    id: 'badge-spline.remove',
    label: 'Remove anchor',
    defaultBinding: { kind: 'contextMenu' },
    enabled: (_deps, at) => {
      const now = input.current;
      const idx = anchorAt(now, at);
      return on(idx >= 0 && !pinned(now, idx) && now.anchors.length > OCTANT_SPLINE_MIN_ANCHORS);
    },
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        const idx = anchorAt(input.current, (params as ImmediateParams | undefined)?.world);
        if (idx < 0) return 'pass';
        input.current.remove(idx);
      },
    },
  };

  const weigh: Action = {
    id: 'badge-spline.weigh',
    label: 'Change anchor weight',
    defaultBinding: { kind: 'wheel' },
    enabled: (_deps, at) => on(anchorAt(input.current, at) >= 0),
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        const { world, deltaY = 0 } = (params ?? {}) as ImmediateParams;
        const now = input.current;
        const idx = anchorAt(now, world);
        if (idx < 0) return 'pass';
        const anchor = now.anchors[idx]!;
        now.commit(idx, { ...anchor, w: wheelWeight(anchor.w, deltaY) });
      },
    },
  };

  return [move, insert, remove, weigh];
}
