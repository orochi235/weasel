import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
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

/** @experimental */
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
