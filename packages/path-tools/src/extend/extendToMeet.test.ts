import { describe, expect, it, vi } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { asNodeId, type NodeId, type Op } from '@weasel-js/core';
import { extendToMeetAction } from './extendToMeet';

interface StubNode { id: NodeId; kind: 'mark'; layer: string; pose: unknown; data: unknown; parent: NodeId | null }

/** Nodes storing their polygon as the pose, back to front in the order given. */
function setup(paths: Record<string, string>, selected: string[] = [], extra: Record<string, unknown> = {}) {
  const nodes = new Map<string, StubNode>();
  for (const [id, d] of Object.entries(paths)) {
    nodes.set(id, { id: asNodeId(id), kind: 'mark', layer: 'main', pose: pathFromD(d), data: {}, parent: null });
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
const run = (a: { invoker?: unknown }, deps: never, params?: Record<string, unknown>) =>
  (a.invoker as ImmediateInvoker).run(deps, params);

describe('extendToMeetAction', () => {
  it("carries a selected path's open ends to the strokes they point at", () => {
    const { deps, batches } = setup({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10' }, ['seg']);
    expect(extendToMeetAction.enabled!(deps)).toBe(true);
    run(extendToMeetAction, deps);
    expect(batches[0].label).toBe('Extend to next path');
    expect(poseOf(batches[0].ops[0])).toEqual([10, 0, 20, 0]);
  });

  it('in path edit, extends only the selected end', () => {
    const editAnchors = { editingId: 'seg', selectedAnchors: new Set([1]) };
    const { deps, batches } = setup({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10' }, ['seg'], { editAnchors });
    run(extendToMeetAction, deps);
    expect(poseOf(batches[0].ops[0])).toEqual([13, 0, 20, 0]);
  });

  it('given a click, extends only the end of the stroke nearest it', () => {
    const { deps, batches } = setup({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10' });
    run(extendToMeetAction, deps, { pressX: 14, pressY: 1, radiusPx: 3 });
    expect(poseOf(batches[0].ops[0])).toEqual([10, 0, 17, 0]);
    expect(extendToMeetAction.enabled!(deps, { x: 14, y: 1 })).toBe(true);
  });

  it('is unavailable when no end meets anything', () => {
    const { deps } = setup({ seg: 'M13 0 H17', far: 'M0 40 H40' }, ['seg']);
    expect(extendToMeetAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });
});
