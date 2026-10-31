import { describe, expect, it, vi } from 'vitest';
import { PathBuilder, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { asNodeId, type Op } from '@weasel-js/core';
import { RESAMPLE_PARAMS, resamplePathAction } from './resample';

/** One selected node storing a 100-unit square as its pose. */
function setup() {
  const node = { id: asNodeId('a'), kind: 'mark', layer: 'main', parent: null, data: {},
    pose: new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build() };
  const scene = {
    get: (id: string) => (id === 'a' ? node : undefined),
    childrenOf: () => [],
    roots: [node.id],
    applyBatch: vi.fn(),
  };
  const selection = { get: () => ['a'], set: vi.fn() };
  const batches: Array<{ ops: Op[]; label: string }> = [];
  const applyOps = vi.fn((ops: Op[], label: string) => { batches.push({ ops, label }); });
  return { deps: { scene, selection, applyOps } as unknown as ActionDeps, batches };
}

const run = (resamplePathAction.invoker as ImmediateInvoker).run;
/** The anchor count of the pose the one batch sets. */
const committedCount = (batches: Array<{ ops: Op[] }>) => {
  const op = batches[0].ops[0] as unknown as { args: { to: unknown } };
  return pathToAnchors(op.args.to as PolygonPath).anchors[0].length;
};

describe('resamplePathAction', () => {
  it('commits one entry at the count its params give', () => {
    const { deps, batches } = setup();
    // Every corner is held, so a count of 8 adds one anchor to each side.
    run(deps, { count: 8, keepCorners: true });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Resample');
    expect(committedCount(batches)).toBe(8);
  });

  it('lets spacing override count', () => {
    const { deps, batches } = setup();
    run(deps, { count: 8, spacing: 20 });
    expect(committedCount(batches)).toBe(20);
  });

  it('declares a form for every param it reads', () => {
    expect(resamplePathAction.params).toBe(RESAMPLE_PARAMS);
    expect(Object.keys(RESAMPLE_PARAMS.children).sort()).toEqual(['count', 'keepCorners', 'spacing', 'tolerance']);
  });
});
