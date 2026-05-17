import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../resize/geometry';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface NudgeDeps<TPose> {
  getSelection: () => NodeId[];
  getPose: (id: NodeId) => TPose;
  translatePose: (pose: TPose, dx: number, dy: number) => TPose;
  applyOps: (ops: Op[], label?: string) => void;
  step?: number;
  shiftStep?: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const KEY_FOR: Record<Direction, string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};
const LABEL_FOR: Record<Direction, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
};
function delta(dir: Direction, step: number): { dx: number; dy: number } {
  switch (dir) {
    case 'up':    return { dx: 0,     dy: -step };
    case 'down':  return { dx: 0,     dy:  step };
    case 'left':  return { dx: -step, dy: 0     };
    case 'right': return { dx:  step, dy: 0     };
  }
}

// ---------------------------------------------------------------------------
// Descriptor constants
// ---------------------------------------------------------------------------

/**
 * Default step sizes used by the static descriptors (`nudgeUpAction` etc.).
 * Hardcoded for Phase 4 — the legacy factory (`defaultNudgeActions`) preserves
 * per-instance configurability via `NudgeDeps.step` / `NudgeDeps.shiftStep`.
 * Consumers wanting non-default step sizes should either:
 *   (a) continue using `defaultNudgeActions` with custom deps, or
 *   (b) register their own gestureBindings with `params: { magnitude: 'big' }`
 *       pointing to `nudge.up` etc. (future enhancement).
 */
const SMALL_STEP = 1;
const BIG_STEP = 10;

// ---------------------------------------------------------------------------
// Shared helper for descriptor invokers
// ---------------------------------------------------------------------------

/**
 * Apply a translation of (dx, dy) to all currently-selected nodes via the
 * scene API. Uses the kit's default rect-pose `translate` implementation
 * so the descriptor works for any axis-aligned rect pose without consumer
 * geometry config.
 */
function nudgeSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  dx: number,
  dy: number,
): void {
  const ids = selection.get();
  if (ids.length === 0) return;
  const translate = (RECT_POSE_DESCRIPTOR as PoseDescriptor<unknown>).translate!;
  scene.batch('Nudge', () => {
    for (const id of ids) {
      const node = scene.get(id);
      if (!node) continue;
      const next = translate(node.pose, dx, dy);
      scene.setPose(id, next);
    }
  });
}

// ---------------------------------------------------------------------------
// Static descriptors (Phase 4+)
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Build one static nudge descriptor for the given direction.
 *
 * Each descriptor collapses what were previously two actions (`nudge.${dir}`
 * and `nudge.${dir}.big`) into a single action with two parametric gesture
 * bindings:
 *   - bare ArrowKey  → magnitude: 'small' (SMALL_STEP = 1)
 *   - Shift+ArrowKey → magnitude: 'big'   (BIG_STEP  = 10)
 *
 * Step sizes are hardcoded for Phase 4 — see `SMALL_STEP` / `BIG_STEP` above.
 * The legacy factory (`defaultNudgeActions`) preserves per-instance step config.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 */
function makeNudgeAction(dir: Direction): Action {
  return {
    id: `nudge.${dir}`,
    label: `Nudge ${LABEL_FOR[dir]}`,
    gestureBinding: [
      { spec: { kind: 'key', key: KEY_FOR[dir] },                              opts: { params: { magnitude: 'small' } } },
      { spec: { kind: 'key', key: KEY_FOR[dir], mods: { shift: true } }, opts: { params: { magnitude: 'big' } } },
    ],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const magnitude = (params?.magnitude as 'small' | 'big' | undefined) ?? 'small';
        const step = magnitude === 'big' ? BIG_STEP : SMALL_STEP;
        const { dx, dy } = delta(dir, step);
        const selection = deps.selection as SelectionApi | undefined;
        const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
        if (!selection || !scene) return;
        nudgeSelection(selection, scene, dx, dy);
      },
    },
    enabled: () => ActionDisabledReason.SelectionRequired,
  };
}

export const nudgeUpAction    = makeNudgeAction('up');
export const nudgeDownAction  = makeNudgeAction('down');
export const nudgeLeftAction  = makeNudgeAction('left');
export const nudgeRightAction = makeNudgeAction('right');

// ---------------------------------------------------------------------------
// Legacy bridge factory (preserves 8-action shape + per-instance step config)
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Factory for the legacy 8-action nudge set.
 *
 * Preserves the pre-Phase-4 shape — one action per direction per magnitude
 * (`nudge.up`, `nudge.up.big`, …) — so consumers relying on distinct action
 * ids in palette / menu UIs keep working without changes.
 *
 * Per-instance step sizes (`deps.step`, `deps.shiftStep`) are preserved here;
 * the static descriptors (`nudgeUpAction` etc.) hardcode SMALL_STEP/BIG_STEP.
 *
 * @deprecated Phase 4+: prefer the static descriptors (`nudgeUpAction` etc.)
 * with parametric bindings. This wrapper is a Phase 4–7 transition shim and
 * will be removed in Phase 8.
 */
export function defaultNudgeActions<TPose>(deps: NudgeDeps<TPose>): Action[] {
  const step = deps.step ?? 1;
  const shiftStep = deps.shiftStep ?? 10;
  const out: Action[] = [];
  for (const dir of DIRECTIONS) {
    out.push(makeOne(dir, step, false));
    out.push(makeOne(dir, shiftStep, true));
  }
  return out;

  function makeOne(dir: Direction, useStep: number, big: boolean): Action {
    const id = big ? `nudge.${dir}.big` : `nudge.${dir}`;
    const label = big ? `Nudge ${LABEL_FOR[dir]} (Big)` : `Nudge ${LABEL_FOR[dir]}`;
    const binding = big ? { key: KEY_FOR[dir], shift: true as const } : { key: KEY_FOR[dir] };
    const gestureBinding = big
      ? { kind: 'key' as const, key: KEY_FOR[dir], mods: { shift: true as const } }
      : { kind: 'key' as const, key: KEY_FOR[dir] };
    return {
      id, label, defaultBinding: binding, gestureBinding,
      run: () => {
        const sel = deps.getSelection();
        if (sel.length === 0) return;
        const { dx, dy } = delta(dir, useStep);
        const ops: Op[] = sel.map((nid) => {
          const from = deps.getPose(nid);
          const to = deps.translatePose(from, dx, dy);
          return createTransformOp<TPose>({ id: nid, from, to });
        });
        deps.applyOps(ops, 'Nudge');
      },
      enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
    };
  }
}
