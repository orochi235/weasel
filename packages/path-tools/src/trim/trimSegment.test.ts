import { describe, expect, it, vi } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { asNodeId, type NodeId, type Op } from '@weasel-js/core';
import { planTrim, trimPathAction } from './trimSegment';

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

const poseOf = (op: Op) => Array.from(((op.args as { to: PolygonPath }).to).coords);
const run = (a: { invoker?: unknown }, deps: never, params?: Record<string, unknown>) =>
  (a.invoker as ImmediateInvoker).run(deps, params);

describe('trimPathAction', () => {
  const walls = { w1: 'M10 -10 V10', w2: 'M20 -10 V10' };

  it('removes the clicked piece between two crossings, in one undo step', () => {
    const { deps, batches } = setup({ line: 'M0 0 H30', ...walls });
    run(trimPathAction, deps, { press: { x: 15, y: 2 }, radiusPx: 3 });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Trim segment');
    expect(poseOf(batches[0].ops[0])).toEqual([0, 0, 10, 0, 20, 0, 30, 0]);
  });

  it('trims the topmost stroke under the click', () => {
    const { deps, batches } = setup({ line: 'M0 0 H30', ...walls });
    run(trimPathAction, deps, { press: { x: 20, y: 6 } });
    expect((batches[0].ops[0].args as { id: string }).id).toBe('w2');
  });

  it('deletes a stroke with nothing left of it', () => {
    const { deps, batches, selection } = setup({ stub: 'M10 0 H20', ...walls }, ['stub']);
    run(trimPathAction, deps, { press: { x: 15, y: 0 }, radiusPx: 3 });
    expect(batches[0].ops[0].name).toBe('delete');
    expect(selection.set).toHaveBeenCalledWith([]);
  });

  it("plans from a hover's pointer what the click would cut, and cuts nothing", () => {
    const { deps, batches } = setup({ line: 'M0 0 H30', ...walls });
    const plan = planTrim(deps, { world: { x: 15, y: 2 }, radiusPx: 3 })!;
    expect(plan.target.id).toBe('line');
    expect(Array.from(plan.result.removed.coords)).toEqual([10, 0, 20, 0]);
    expect(batches).toHaveLength(0);
  });

  it('trims a leaf drawn as its rect pose alone, writing the path it is left with', () => {
    const { deps, batches, nodes } = setup(walls);
    nodes.set('box', {
      id: asNodeId('box'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 30, height: 20 }, data: { tag: 1 }, parent: null,
    });
    // The walls are drawn first, so the box is topmost under the click.
    run(trimPathAction, deps, { press: { x: 15, y: 1 }, radiusPx: 3 });
    expect(batches).toHaveLength(1);
    const set = batches[0].ops.find((op) => op.name === 'setData')!;
    expect((set.args as { from: unknown }).from).toEqual({ tag: 1 });
    const to = (set.args as { to: { tag: number; path: PolygonPath } }).to;
    expect(to.tag).toBe(1);
    // The top edge loses its stretch between the walls: the rest runs open from x 20 round to x 10.
    expect(Array.from(to.path.coords)).toEqual([20, 0, 30, 0, 30, 20, 0, 20, 0, 0, 10, 0]);
  });

  it('does nothing off every stroke, or on one nothing crosses', () => {
    const { deps, batches } = setup({ line: 'M0 0 H30', lone: 'M0 50 H30', ...walls });
    run(trimPathAction, deps, { press: { x: 15, y: 25 } });
    run(trimPathAction, deps, { press: { x: 15, y: 50 } });
    expect(batches).toHaveLength(0);
  });
});
