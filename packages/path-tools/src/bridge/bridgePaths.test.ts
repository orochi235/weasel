import { describe, expect, it, vi } from 'vitest';
import { PathBuilder, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ImmediateInvoker, type InvocationCtx } from '@weasel-js/routing';
import { asNodeId, type NodeId, type Op } from '@weasel-js/core';
import { bridgePathsAction, DEFAULT_BRIDGE_TENSION } from './bridge';

interface StubNode { id: NodeId; kind: 'mark'; layer: string; pose: unknown; data: unknown; parent: NodeId | null }

/** A scene whose nodes store their polygon as the pose. */
function setup(nodes: Record<string, { pose: unknown; data: unknown }>, selected: string[], extra: Record<string, unknown> = {}) {
  const byId = new Map<string, StubNode>();
  for (const [id, n] of Object.entries(nodes)) byId.set(id, { id: asNodeId(id), kind: 'mark', layer: 'main', parent: null, ...n });
  const scene = {
    get: (id: NodeId) => byId.get(id),
    childrenOf: () => [],
    get roots() { return [...byId.keys()].map(asNodeId); },
    mintId: () => asNodeId('minted'),
    applyBatch: vi.fn(),
  };
  let current = selected;
  const selection = { get: () => current, set: vi.fn((next: string[]) => { current = next; }) };
  const batches: Array<{ ops: Op[]; label: string }> = [];
  const applyOps = vi.fn((ops: Op[], label: string) => { batches.push({ ops, label }); });
  const deps = { scene, selection, applyOps, ...extra } as unknown as InvocationCtx['deps'];
  return { deps, batches, selection };
}

const run = (action: { invoker?: unknown }, deps: InvocationCtx['deps'], params?: Record<string, unknown>) =>
  (action.invoker as ImmediateInvoker).run(deps, params);
const to = (op: Op) => (op.args as { to: unknown }).to;
const line = (x0: number, y0: number, x1: number, y1: number) => new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build();

describe('bridgePathsAction', () => {
  it('makes two paths one, through a curve meeting each end along its line, as one undo step', () => {
    const { deps, batches, selection } = setup({
      a: { pose: line(0, 0, 10, 0), data: {} },
      b: { pose: line(30, 10, 40, 10), data: {} },
    }, ['a', 'b']);
    run(bridgePathsAction, deps, { tension: 0.5 });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Bridge');
    expect(batches[0].ops.map((o) => o.name)).toEqual(['transform', 'delete']);
    const [run0] = pathToAnchors(to(batches[0].ops[0]) as PolygonPath).anchors;
    const half = Math.hypot(20, 10) / 2;
    expect(run0.map((p) => p.x)).toEqual([0, 10, 30, 40]);
    expect(run0[1].outHandle!.x).toBeCloseTo(10 + half, 4);
    expect(run0[1].outHandle!.y).toBeCloseTo(0, 4);
    expect(run0[2].inHandle!.x).toBeCloseTo(30 - half, 4);
    expect(run0[2].inHandle!.y).toBeCloseTo(10, 4);
    expect(selection.set).toHaveBeenLastCalledWith(['a']);
  });

  it('takes the default tension when its params name none, and yields to path edit', () => {
    const { deps, batches } = setup({ a: { pose: line(0, 0, 10, 0), data: {} }, b: { pose: line(30, 0, 40, 0), data: {} } }, ['a', 'b']);
    run(bridgePathsAction, deps);
    const [run0] = pathToAnchors(to(batches[0].ops[0]) as PolygonPath).anchors;
    expect(run0[1].outHandle!.x).toBeCloseTo(10 + 20 * DEFAULT_BRIDGE_TENSION, 4);
    const editing = setup({ a: { pose: line(0, 0, 1, 0), data: {} } }, ['a'], { editAnchors: { editingId: 'a' } });
    expect(bridgePathsAction.enabled!(editing.deps)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('closes one selected path with a curve', () => {
    const arc = new PathBuilder().moveTo(0, 0).lineTo(10, 10).lineTo(20, 0).build();
    const { deps, batches } = setup({ a: { pose: arc, data: {} } }, ['a']);
    expect(bridgePathsAction.enabled!(deps)).toBe(true);
    run(bridgePathsAction, deps);
    const set = pathToAnchors(to(batches[0].ops[0]) as PolygonPath);
    expect(set.closed).toEqual([true]);
    expect(set.anchors[0][2].outHandle).toBeDefined();
    expect(set.anchors[0][0].inHandle).toBeDefined();
  });
});
