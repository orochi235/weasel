import { describe, it, expect, vi } from 'vitest';
import { defaultAlignActions } from './align';
import { RECT_POSE_DESCRIPTOR } from '../../gestures/resize/geometry';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';

interface Pose { x: number; y: number; width: number; height: number }

function applyOp(op: Op): { id?: string; pose?: Pose } {
  const captured: { id?: string; pose?: Pose } = {};
  op.apply({ setPose(id: string, pose: Pose) { captured.id = id; captured.pose = pose; } });
  return captured;
}

function makeDeps(poses: Record<string, Pose>) {
  return {
    getSelection: () => Object.keys(poses).map((k) => asNodeId(k)),
    getPose: (id: string): Pose => poses[id],
    geometry: RECT_POSE_DESCRIPTOR as unknown as import('../../gestures/resize/geometry').PoseDescriptor<Pose>,
    applyOps: vi.fn(),
  };
}

describe('defaultAlignActions', () => {
  it('returns 6 actions with documented ids', () => {
    const acts = defaultAlignActions(makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } }));
    expect(acts.map((a) => a.id).sort()).toEqual([
      'align.bottom', 'align.centerX', 'align.centerY', 'align.left', 'align.right', 'align.top',
    ]);
  });

  it('no default keybindings (consumer overrides)', () => {
    const acts = defaultAlignActions(makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } }));
    for (const a of acts) expect(a.defaultBinding).toBeUndefined();
  });

  it('align.left translates each item to the union left', () => {
    const deps = makeDeps({
      a: { x: 5, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 50, width: 10, height: 10 },
    });
    defaultAlignActions(deps).find((a) => a.id === 'align.left')!.run();
    expect(deps.applyOps).toHaveBeenCalledOnce();
    const [ops, label] = deps.applyOps.mock.calls[0];
    expect(label).toBe('Align');
    expect(ops).toHaveLength(1); // only `b` moves; `a` already at union.left
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 5, y: 50 });
  });

  it('run() is a no-op on <2 selection', () => {
    const deps = makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } });
    defaultAlignActions(deps).find((a) => a.id === 'align.left')!.run();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('enabled: SelectionRequired when <2, true when ≥2', () => {
    const one = makeDeps({ a: { x: 0, y: 0, width: 10, height: 10 } });
    expect(defaultAlignActions(one)[0].enabled!()).toBe('selection-required');
    const two = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 5, y: 0, width: 10, height: 10 },
    });
    expect(defaultAlignActions(two)[0].enabled!()).toBe(true);
  });
});
