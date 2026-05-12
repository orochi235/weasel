import { describe, it, expect, vi } from 'vitest';
import { defaultDistributeActions } from './distribute';
import { RECT_POSE_DESCRIPTOR } from '../../gestures/resize/geometry';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';

interface Pose { x: number; y: number; width: number; height: number }

function applyOp(op: Op): { id?: string; pose?: Pose } {
  const captured: { id?: string; pose?: Pose } = {};
  op.apply({ setPose(id: string, pose: Pose) { captured.id = id; captured.pose = pose; } });
  return captured;
}

function makeDeps(poses: Record<string, Pose>, mode?: 'centers' | 'gaps') {
  return {
    getSelection: () => Object.keys(poses).map((k) => asNodeId(k)),
    getPose: (id: string): Pose => poses[id],
    geometry: RECT_POSE_DESCRIPTOR as unknown as import('../../gestures/resize/geometry').PoseDescriptor<Pose>,
    applyOps: vi.fn(),
    mode,
  };
}

describe('defaultDistributeActions', () => {
  it('returns 2 actions with documented ids', () => {
    const acts = defaultDistributeActions(makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    }));
    expect(acts.map((a) => a.id).sort()).toEqual(['distribute.horizontal', 'distribute.vertical']);
  });

  it('no default keybindings', () => {
    const acts = defaultDistributeActions(makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    }));
    for (const a of acts) expect(a.defaultBinding).toBeUndefined();
  });

  it('distribute.horizontal centers mode evenly spaces middle items', () => {
    const deps = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 30, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    defaultDistributeActions(deps).find((a) => a.id === 'distribute.horizontal')!.run();
    expect(deps.applyOps).toHaveBeenCalledOnce();
    const [ops, label] = deps.applyOps.mock.calls[0];
    expect(label).toBe('Distribute');
    expect(ops).toHaveLength(1); // only b moves
    // centers: a center=5, c center=105 → b center should land at 55, so x=50
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 50, y: 0 });
  });

  it('mode override via deps.mode', () => {
    const deps = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 30, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    }, 'gaps');
    defaultDistributeActions(deps).find((a) => a.id === 'distribute.horizontal')!.run();
    const [ops] = deps.applyOps.mock.calls[0];
    // span = 110-0 = 110, sumSizes = 10+30+10 = 50, gap = (110-50)/2 = 30
    // a stays at 0; b should land at 0 + 10 + 30 = 40
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 40, y: 0 });
  });

  it('run() is a no-op on <3 selection', () => {
    const deps = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
    });
    defaultDistributeActions(deps).find((a) => a.id === 'distribute.horizontal')!.run();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('enabled: SelectionRequired when <3, true when ≥3', () => {
    const two = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
    });
    expect(defaultDistributeActions(two)[0].enabled!()).toBe('selection-required');
    const three = makeDeps({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 20, y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    expect(defaultDistributeActions(three)[0].enabled!()).toBe(true);
  });
});
