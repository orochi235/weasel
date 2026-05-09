import { describe, it, expect, vi } from 'vitest';
import { defaultNudgeActions } from './nudge';
import type { Op } from '../../../core/ops/types';

type Pose = { x: number; y: number; width: number; height: number };

function applyOp(op: Op): { id?: string; pose?: Pose } {
  const captured: { id?: string; pose?: Pose } = {};
  op.apply({ setPose(id: string, pose: Pose) { captured.id = id; captured.pose = pose; } });
  return captured;
}

function makeDeps() {
  return {
    getSelection: () => ['a'],
    getPose: (_id: string): Pose => ({ x: 10, y: 10, width: 1, height: 1 }),
    translatePose: (p: Pose, dx: number, dy: number) => ({ ...p, x: p.x + dx, y: p.y + dy }),
    applyBatch: vi.fn(),
    step: 1,
    shiftStep: 10,
  };
}

describe('defaultNudgeActions', () => {
  it('returns 8 actions with the documented ids', () => {
    const acts = defaultNudgeActions(makeDeps());
    expect(acts.map(a => a.id).sort()).toEqual([
      'nudge.down', 'nudge.down.big',
      'nudge.left', 'nudge.left.big',
      'nudge.right', 'nudge.right.big',
      'nudge.up', 'nudge.up.big',
    ]);
  });

  it('nudge.up binding = ArrowUp, no shift', () => {
    const a = defaultNudgeActions(makeDeps()).find(x => x.id === 'nudge.up')!;
    expect(a.defaultBinding).toEqual({ key: 'ArrowUp' });
  });

  it('nudge.up.big binding = ArrowUp, shift:true', () => {
    const a = defaultNudgeActions(makeDeps()).find(x => x.id === 'nudge.up.big')!;
    expect(a.defaultBinding).toEqual({ key: 'ArrowUp', shift: true });
  });

  it('nudge.left.big binding = ArrowLeft, shift:true', () => {
    const a = defaultNudgeActions(makeDeps()).find(x => x.id === 'nudge.left.big')!;
    expect(a.defaultBinding).toEqual({ key: 'ArrowLeft', shift: true });
  });

  it('label is "Nudge <Direction>" / "Nudge <Direction> (Big)"', () => {
    const acts = defaultNudgeActions(makeDeps());
    expect(acts.find(a => a.id === 'nudge.up')!.label).toBe('Nudge Up');
    expect(acts.find(a => a.id === 'nudge.up.big')!.label).toBe('Nudge Up (Big)');
  });

  it('run() of nudge.up applies dy=-step', () => {
    const deps = makeDeps();
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.up')!;
    a.run();
    const ops = deps.applyBatch.mock.calls[0][0];
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 10, y: 9 });
  });

  it('run() of nudge.up.big applies dy=-shiftStep', () => {
    const deps = makeDeps();
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.up.big')!;
    a.run();
    const ops = deps.applyBatch.mock.calls[0][0];
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 10, y: 0 });
  });

  it('run() of nudge.right applies dx=+step', () => {
    const deps = makeDeps();
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.right')!;
    a.run();
    const ops = deps.applyBatch.mock.calls[0][0];
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 11, y: 10 });
  });

  it('run() is a no-op on empty selection', () => {
    const deps = { ...makeDeps(), getSelection: () => [] };
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.up')!;
    a.run();
    expect(deps.applyBatch).not.toHaveBeenCalled();
  });

  it('default step=1, shiftStep=10 when not provided', () => {
    const deps = {
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 1, height: 1 }),
      translatePose: (p: Pose, dx: number, dy: number) => ({ ...p, x: p.x + dx, y: p.y + dy }),
      applyBatch: vi.fn(),
    };
    const acts = defaultNudgeActions<Pose>(deps);
    acts.find(a => a.id === 'nudge.right')!.run();
    expect(applyOp(deps.applyBatch.mock.calls[0][0][0]).pose).toMatchObject({ x: 1 });
    deps.applyBatch.mockClear();
    acts.find(a => a.id === 'nudge.right.big')!.run();
    expect(applyOp(deps.applyBatch.mock.calls[0][0][0]).pose).toMatchObject({ x: 10 });
  });
});
