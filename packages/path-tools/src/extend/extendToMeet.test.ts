import { describe, expect, it, vi } from 'vitest';
import { pathFromD, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { asNodeId, type NodeId, type Op } from '@weasel-js/core';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
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
  return { deps, batches, selection, nodes };
}

/** `setup` in path edit on `editing`, with `selected` anchors selected; edits land on the node's pose. */
function inPathEdit(paths: Record<string, string>, editing: string, selected: number[]) {
  const edits: Array<{ path: PolygonPath; label: string }> = [];
  const holder: { nodes?: Map<string, StubNode> } = {};
  const editAnchors = makeEditAnchorsDep({
    editingId: editing,
    getEditablePath: (id) => holder.nodes!.get(id)?.pose as PolygonPath,
    applyEdit: (id, path, label) => {
      holder.nodes!.get(id)!.pose = path;
      edits.push({ path: path as PolygonPath, label });
    },
  });
  editAnchors.setSelectedAnchors(selected);
  const t = setup(paths, [editing], { editAnchors });
  holder.nodes = t.nodes;
  return { ...t, editAnchors, edits };
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
    const { deps, edits } = inPathEdit({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10' }, 'seg', [1]);
    run(extendToMeetAction, deps);
    expect(edits.map((e) => e.label)).toEqual(['Extend to next path']);
    expect(Array.from(edits[0].path.coords)).toEqual([13, 0, 20, 0]);
  });

  it('in path edit, keeps the selection on the end it carried on, past the anchors it added', () => {
    const paths = { arc: 'M0 0 A50 50 0 0 1 25 6.69872981', wall: 'M-200 120 H400' };
    const before = pathToAnchors(pathFromD(paths.arc)).anchors[0].length;
    const { deps, edits, editAnchors } = inPathEdit(paths, 'arc', [before - 1]);
    run(extendToMeetAction, deps);
    expect(edits).toHaveLength(1);
    const after = pathToAnchors(edits[0].path).anchors[0].length;
    expect(after).toBeGreaterThan(before);
    expect([...editAnchors.selectedAnchors]).toEqual([after - 1]);
  });

  it('given a click, extends only the end of the stroke nearest it', () => {
    const { deps, batches } = setup({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10' });
    run(extendToMeetAction, deps, { press: { x: 14, y: 1 }, radiusPx: 3 });
    expect(poseOf(batches[0].ops[0])).toEqual([10, 0, 17, 0]);
    expect(extendToMeetAction.enabled!(deps, { x: 14, y: 1 })).toBe(true);
  });

  it('eases a curved end out of its bend by default, and runs it straight given that shape', () => {
    const paths = { arc: 'M0 0 A50 50 0 0 1 25 6.69872981', wall: 'M-200 120 H400' };
    const cmds = (op: Op) => Array.from(((op.args as { to: PolygonPath }).to).commands);
    const eased = setup(paths, ['arc']);
    run(extendToMeetAction, eased.deps);
    const straight = setup(paths, ['arc']);
    run(extendToMeetAction, straight.deps, { shape: 'straight' });
    const before = Array.from(pathFromD(paths.arc).commands).length;
    expect(cmds(straight.batches[0].ops[0])).toHaveLength(before + 1);
    expect(cmds(eased.batches[0].ops[0]).length).toBeGreaterThan(before + 1);
    expect(extendToMeetAction.params).toBeDefined();
  });

  it('is unavailable when no end meets anything', () => {
    const { deps } = setup({ seg: 'M13 0 H17', far: 'M0 40 H40' }, ['seg']);
    expect(extendToMeetAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('given a click, passes over a locked or hidden stroke, and runs on past a hidden one', () => {
    const { deps, batches } = setup({ seg: 'M13 0 H17', w1: 'M10 -10 V10', w2: 'M20 -10 V10', top: 'M13 1 H17' });
    const scene = (deps as { scene: Record<string, unknown> }).scene;
    scene.isLocked = (id: string) => id === 'top';
    scene.isHidden = (id: string) => id === 'w2';
    run(extendToMeetAction, deps, { press: { x: 14, y: 0 }, radiusPx: 3 });
    expect((batches[0].ops[0].args as { id: string }).id).toBe('seg');
    expect(poseOf(batches[0].ops[0])).toEqual([10, 0, 17, 0]);
  });
});
