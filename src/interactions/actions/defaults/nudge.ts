import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { RECT_POSE_DESCRIPTOR, type PoseProjection } from '../resize/geometry';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

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
 * Apply a translation of (dx, dy) to all currently-selected nodes via the
 * scene API. Uses the kit's default rect-pose `translate` so the descriptor
 * works for any axis-aligned rect pose without consumer geometry config.
 */
function nudgeSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  dx: number,
  dy: number,
): void {
  const ids = selection.get();
  if (ids.length === 0) return;
  const translate = (RECT_POSE_DESCRIPTOR as PoseProjection<unknown>).translate!;
  scene.batch('Nudge', () => {
    for (const id of ids) {
      const node = scene.get(id);
      if (!node) continue;
      const next = translate(node.pose, dx, dy);
      scene.setPose(id, next);
    }
  });
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
    defaultBinding: [
      { spec: { kind: 'key', key: KEY_FOR[dir] },                              opts: { params: { magnitude: 'small' } } },
      { spec: { kind: 'key', key: KEY_FOR[dir], mods: { shift: true } }, opts: { params: { magnitude: 'big' } } },
    ],
    requires: ['selection', 'scene'],
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
