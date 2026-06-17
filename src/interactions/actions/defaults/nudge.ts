import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { RECT_POSE_DESCRIPTOR, type PoseProjection } from '../resize/geometry';
import type { Action } from '../registry';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { requiresSelection } from './requiresSelection';

type Direction = 'up' | 'down' | 'left' | 'right';
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

/** Default step sizes used by the nudge descriptors. */
const SMALL_STEP = 1;
const BIG_STEP = 10;

/**
 * Apply a translation of (dx, dy) to all currently-selected nodes by building
 * one `createTransformOp` per node (from = pre-mutation pose, to = nudged
 * pose) and routing the batch through the consumer commit hook. Uses the kit's
 * default rect-pose `translate` so the descriptor works for any axis-aligned
 * rect pose without consumer geometry config.
 *
 * Mirrors `moveAction`'s `commitOps` helper: when `deps.applyOps` is present
 * the ops route through the consumer's history (one undo entry there);
 * otherwise they apply straight to the scene's own history via
 * `scene.applyBatch` + `defaultCommitAdapter`. Either way the whole nudge is a
 * single batch → one undo entry, preserving the old `scene.batch('Nudge', …)`
 * semantics exactly.
 */
function nudgeSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  dx: number,
  dy: number,
  applyOps?: (ops: Op[], label: string) => void,
): void {
  const ids = selection.get();
  if (ids.length === 0) return;
  const translate = (RECT_POSE_DESCRIPTOR as PoseProjection<unknown>).translate!;

  // Read poses BEFORE building ops so each op's `from` is the pre-mutation
  // value (the same value the old direct mutation captured implicitly).
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    ops.push(createTransformOp<unknown>({
      id: id as string,
      from: node.pose,
      to: translate(node.pose, dx, dy),
      label: 'Nudge',
    }));
  }
  if (ops.length === 0) return;

  if (applyOps) applyOps(ops, 'Nudge');
  else scene.applyBatch(ops, 'Nudge', defaultCommitAdapter(scene));
}

/**
 * @experimental
 * Build one static nudge descriptor for the given direction. Each descriptor
 * carries two parametric bindings: bare arrow (magnitude='small') and
 * Shift+arrow (magnitude='big').
 *
 * Requires dep-schema entries: `selection`, `scene`.
 */
function makeNudgeAction(dir: Direction): Action & { requires: string[] } {
  return {
    id: `nudge.${dir}`,
    label: `Nudge ${LABEL_FOR[dir]}`,
    group: 'nudge',
    defaultBinding: [
      { spec: { kind: 'key', key: KEY_FOR[dir] },                              opts: { params: { magnitude: 'small' } } },
      { spec: { kind: 'key', key: KEY_FOR[dir], mods: { shift: true } }, opts: { params: { magnitude: 'big' } } },
    ],
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const magnitude = (params?.magnitude as 'small' | 'big' | undefined) ?? 'small';
        const step = magnitude === 'big' ? BIG_STEP : SMALL_STEP;
        const { dx, dy } = delta(dir, step);
        const selection = deps.selection as SelectionApi | undefined;
        const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
        const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
        if (!selection || !scene) return;
        nudgeSelection(selection, scene, dx, dy, applyOps);
      },
    },
    enabled: requiresSelection,
  };
}

export const nudgeUpAction    = makeNudgeAction('up');
export const nudgeDownAction  = makeNudgeAction('down');
export const nudgeLeftAction  = makeNudgeAction('left');
export const nudgeRightAction = makeNudgeAction('right');
