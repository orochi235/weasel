import { describe, it, expect, vi } from 'vitest';
import { defaultFlipActions } from './flip';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';

interface Pose { x: number; y: number; width: number; height: number }

function applyOp(op: Op): { id?: string; pose?: Pose } {
  const captured: { id?: string; pose?: Pose } = {};
  op.apply({ setPose(id: string, pose: Pose) { captured.id = id; captured.pose = pose; } });
  return captured;
}

function makeDeps() {
  return {
    getSelection: () => [asNodeId('a')],
    getPose: (_id: string): Pose => ({ x: 10, y: 20, width: 30, height: 40 }),
    geometry: RECT_POSE_DESCRIPTOR as unknown as import('../resize/geometry').PoseDescriptor<Pose>,
    applyOps: vi.fn(),
  };
}

describe('defaultFlipActions', () => {
  it('returns 2 actions with documented ids', () => {
    const acts = defaultFlipActions(makeDeps());
    expect(acts.map(a => a.id).sort()).toEqual(['flip.horizontal', 'flip.vertical']);
  });
  it('flip.horizontal binding = Shift+H', () => {
    const a = defaultFlipActions(makeDeps()).find(x => x.id === 'flip.horizontal')!;
    expect(a.defaultBinding).toEqual({ key: ['h', 'H'], shift: true });
  });
  it('flip.vertical binding = Shift+V', () => {
    const a = defaultFlipActions(makeDeps()).find(x => x.id === 'flip.vertical')!;
    expect(a.defaultBinding).toEqual({ key: ['v', 'V'], shift: true });
  });
  it('labels are "Flip Horizontal" / "Flip Vertical"', () => {
    const acts = defaultFlipActions(makeDeps());
    expect(acts.find(a => a.id === 'flip.horizontal')!.label).toBe('Flip Horizontal');
    expect(acts.find(a => a.id === 'flip.vertical')!.label).toBe('Flip Vertical');
  });
  it('run() emits one transform op per selected id, label "Flip"', () => {
    const deps = makeDeps();
    defaultFlipActions(deps).find(a => a.id === 'flip.horizontal')!.run();
    expect(deps.applyOps).toHaveBeenCalledOnce();
    const [ops, label] = deps.applyOps.mock.calls[0];
    expect(label).toBe('Flip');
    expect(ops).toHaveLength(1);
    expect(applyOp(ops[0]).pose).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });
  it('run() is a no-op on empty selection', () => {
    const deps = { ...makeDeps(), getSelection: () => [] };
    defaultFlipActions(deps).find(a => a.id === 'flip.horizontal')!.run();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });
  it('enabled: SelectionRequired when empty, true when present', () => {
    const empty = { ...makeDeps(), getSelection: () => [] };
    const a1 = defaultFlipActions(empty).find(x => x.id === 'flip.horizontal')!;
    expect(a1.enabled!()).toBe('selection-required');
    const full = makeDeps();
    const a2 = defaultFlipActions(full).find(x => x.id === 'flip.horizontal')!;
    expect(a2.enabled!()).toBe(true);
  });
});
