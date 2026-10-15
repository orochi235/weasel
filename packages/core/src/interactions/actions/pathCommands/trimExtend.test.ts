import { describe, expect, it, vi } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';
import { extendToMeetAction, trimPathAction } from './trimExtend';

interface StubNode { id: NodeId; kind: 'leaf'; layer: string; pose: unknown; data: unknown; parent: NodeId | null }

/** Nodes storing their polygon as the pose, back to front in the order given. */
function setup(paths: Record<string, string>, selected: string[] = [], extra: Record<string, unknown> = {}) {
  const nodes = new Map<string, StubNode>();
  for (const [id, d] of Object.entries(paths)) {
    nodes.set(id, { id: asNodeId(id), kind: 'leaf', layer: 'main', pose: pathFromD(d), data: {}, parent: null });
  }
  const scene = {
    get: (id: NodeId) => nodes.get(id),
    childrenOf: () => [],
    get roots() { return [...nodes.keys()].map(asNodeId); },
    renderOrderNodes: () => [...nodes.values()],
  };
  let current = selected;
  const selection = { get: () => current, set: vi.fn((next: string[]) => { current = next; }) };
  const batches: Array<{ ops: Op[]; label: string }> = [];
  const applyOps = vi.fn((ops: Op[], label: string) => { batches.push({ ops, label }); });
  const deps = { scene, selection, applyOps, ...extra } as never;
  return { deps, batches, selection };
}

const poseOf = (op: Op) => Array.from(((op.args as { to: PolygonPath }).to).coords);
const run = (a: { invoker: unknown }, deps: never, params?: Record<string, unknown>) =>
  (a.invoker as ImmediateInvoker).run(deps, params);

describe('trimPathAction', () => {
  const walls = { w1: 'M10 -10 V10', w2: 'M20 -10 V10' };

  it('removes the clicked piece between two crossings, in one undo step', () => {
    const { deps, batches } = setup({ line: 'M0 0 H30', ...walls });
    run(trimPathAction, deps, { pressX: 15, pressY: 2, radiusPx: 3 });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Trim');
    expect(poseOf(batches[0].ops[0])).toEqual([0, 0, 10, 0, 20, 0, 30, 0]);
  });

  it('trims the topmost stroke under the click', () => {
    const { deps, batches } = setup({ line: 'M0 0 H30', ...walls });
    run(trimPathAction, deps, { pressX: 20, pressY: 6 });
    expect((batches[0].ops[0].args as { id: string }).id).toBe('w2');
  });

  it('deletes a stroke with nothing left of it', () => {
    const { deps, batches, selection } = setup({ stub: 'M10 0 H20', ...walls }, ['stub']);
    run(trimPathAction, deps, { pressX: 15, pressY: 0, radiusPx: 3 });
    expect(batches[0].ops[0].name).toBe('delete');
    expect(selection.set).toHaveBeenCalledWith([]);
  });

  it('does nothing off every stroke, or on one nothing crosses', () => {
    const { deps, batches } = setup({ line: 'M0 0 H30', lone: 'M0 50 H30', ...walls });
    run(trimPathAction, deps, { pressX: 15, pressY: 25 });
    run(trimPathAction, deps, { pressX: 15, pressY: 50 });
    expect(batches).toHaveLength(0);
  });
});

describe('extendToMeetAction', () => {
  it("carries a selected path's open ends to the strokes they point at", () => {
    const { deps, batches } = setup({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10' }, ['seg']);
    expect(extendToMeetAction.enabled!(deps)).toBe(true);
    run(extendToMeetAction, deps);
    expect(batches[0].label).toBe('Extend to Next Path');
    expect(poseOf(batches[0].ops[0])).toEqual([10, 0, 20, 0]);
  });

  it('in path edit, extends only the selected end', () => {
    const editAnchors = { editingId: 'seg', selectedAnchors: new Set([1]) };
    const { deps, batches } = setup({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10' }, ['seg'], { editAnchors });
    run(extendToMeetAction, deps);
    expect(poseOf(batches[0].ops[0])).toEqual([13, 0, 20, 0]);
  });

  it('is unavailable when no end meets anything', () => {
    const { deps } = setup({ seg: 'M13 0 H17', far: 'M0 40 H40' }, ['seg']);
    expect(extendToMeetAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });
});
