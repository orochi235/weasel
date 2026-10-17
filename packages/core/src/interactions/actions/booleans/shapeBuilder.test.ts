/** `planShapeBuilder`: the faces overlapping paths cut each other into, and committing a pick of them. */
import { describe, it, expect, vi } from 'vitest';
import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { NodeId } from 'core/scene/types';
import type { BooleansAdapter } from './booleans';
import { facesAlong, planShapeBuilder, type ShapeBuilderPlan } from './shapeBuilder';
import { rootsTree } from 'core/adapters/testing/rootsTree';

const rect = (x: number, y: number, width: number, height: number): Path => ({ kind: 'rect', x, y, width, height });

function harness(sources: { id: string; path: Path }[]) {
  const by = new Map(sources.map((s, i) => [s.id, { ...s, z: i }]));
  let n = 0;
  const createPathNode = vi.fn((path: Path) => ({ id: `made${n++}`, path }));
  const applyOps = vi.fn();
  const adapter: BooleansAdapter = {
    ...rootsTree(sources.map((s) => s.id)),
    getSelection: () => sources.map((s) => s.id as NodeId),
    getWorldPath: (id) => by.get(id)?.path,
    compareZ: (a, b) => by.get(a)!.z - by.get(b)!.z,
    getNode: (id) => (by.has(id) ? { id } : undefined),
    createPathNode,
    applyOps,
  };
  return { adapter, createPathNode, applyOps };
}

/** a (back) at 0..10, b in front at 5..15: a alone, b alone, and both. */
function twoBoxes() {
  const h = harness([{ id: 'a', path: rect(0, 0, 10, 10) }, { id: 'b', path: rect(5, 0, 10, 10) }]);
  const plan = planShapeBuilder(h.adapter);
  if (plan.kind !== 'faces') throw new Error(`expected faces, got ${plan.kind}`);
  return { ...h, plan };
}

const box = (path: Path) => {
  const b = boundsOfPath(path);
  return [b.x, b.width];
};
const made = (h: { createPathNode: ReturnType<typeof vi.fn> }) =>
  h.createPathNode.mock.calls.map(([path, producedBy, sourceId]) => [producedBy, sourceId, ...box(path as Path)]);

describe('planShapeBuilder', () => {
  it('answers every face, the source each stands in for, and which face a point is in', () => {
    const { plan } = twoBoxes();
    expect(plan.faces.map((f) => [f.sourceId, ...box(f.path)])).toEqual([['a', 0, 5], ['b', 10, 5], ['b', 5, 5]]);
    expect([plan.faceAt(2, 5), plan.faceAt(12, 5), plan.faceAt(7, 5), plan.faceAt(30, 5)]).toEqual([0, 1, 2, -1]);
  });

  it('splits a region that falls apart into faces of its own', () => {
    const h = harness([{ id: 'box', path: rect(0, 0, 30, 10) }, { id: 'bar', path: rect(10, -5, 10, 20) }]);
    const plan = planShapeBuilder(h.adapter);
    expect(plan.kind === 'faces' && plan.faces.length).toBe(5);
  });

  it('answers why there is nothing to build from fewer than two paths', () => {
    const h = harness([{ id: 'a', path: rect(0, 0, 10, 10) }]);
    expect(planShapeBuilder(h.adapter)).toEqual({ kind: 'noop', reason: 'no-paths' });
  });
});

describe('ShapeBuilderPlan.commit', () => {
  it('unites the picked faces as the first one picked, and keeps the rest as paths of their own', () => {
    const h = twoBoxes();
    const result = h.plan.commit([2, 1], 'merge');
    expect(made(h)).toEqual([['divide', 'a', 0, 5], ['union', 'b', 5, 10]]);
    expect(result).toEqual({ kind: 'applied', resultIds: ['made0', 'made1'] });
    expect(h.applyOps).toHaveBeenCalledTimes(1);
    expect(h.applyOps.mock.calls[0]![1]).toBe('Shape Builder');
  });

  it('takes its source from the face picked first', () => {
    const h = twoBoxes();
    h.plan.commit([0, 2], 'merge');
    expect(made(h)).toEqual([['union', 'a', 0, 10], ['divide', 'b', 10, 5]]);
  });

  it('deletes the picked faces and keeps the rest', () => {
    const h = twoBoxes();
    h.plan.commit([2], 'delete');
    expect(made(h)).toEqual([['divide', 'a', 0, 5], ['divide', 'b', 10, 5]]);
    expect(h.applyOps).toHaveBeenCalledTimes(1);
  });

  it('commits nothing when nothing is picked', () => {
    const h = twoBoxes();
    expect(h.plan.commit([], 'merge')).toEqual({ kind: 'noop', reason: 'empty-result' });
    expect(h.applyOps).not.toHaveBeenCalled();
  });
});

describe('facesAlong', () => {
  it('names each face a run passes through once, in the order it enters them', () => {
    const { plan }: { plan: ShapeBuilderPlan } = twoBoxes();
    expect(facesAlong(plan, [{ x: 13, y: 5 }, { x: 1, y: 5 }], 0.5)).toEqual([1, 2, 0]);
    expect(facesAlong(plan, [{ x: 7, y: 5 }, { x: 7, y: 8 }, { x: 12, y: 8 }], 0.5)).toEqual([2, 1]);
  });
});
