import { describe, expect, it, vi } from 'vitest';
import { PathBuilder, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { asNodeId, type Op } from '@weasel-js/core';
import { resamplePathAction } from './resample';

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
  return { deps: { scene, selection, applyOps } as unknown as InvocationCtx['deps'], batches };
}

const ctx = (deps: InvocationCtx['deps'], params?: Record<string, unknown>): InvocationCtx => ({
  world: { x: 0, y: 0 },
  screen: { x: 0, y: 0 },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps,
  ...(params ? { params } : {}),
});

const ongoing = resamplePathAction.invoker as OngoingInvoker;
const count = (p: unknown) => pathToAnchors(p as PolygonPath).anchors[0].length;

describe('resamplePathAction', () => {
  it('previews each change of params and commits the last as one entry', () => {
    const { deps, batches } = setup();
    const handle = ongoing.start(ctx(deps, { count: 8, keepCorners: true }), {});
    // Every corner is held, so a count of 8 adds one anchor to each side.
    expect(count(handle.previewPose!('a'))).toBe(8);
    handle.onMove!(ctx(deps, { spacing: 20 }));
    expect(count(handle.previewPose!('a'))).toBe(20);
    handle.onMove!(ctx(deps, { keepCorners: false, spacing: 0, count: 6, tolerance: 1 }));
    expect(count(handle.previewPose!('a'))).toBeGreaterThanOrEqual(6);
    expect(batches).toHaveLength(0);
    handle.onEnd!(ctx(deps), 'commit');
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Resample');
  });

  it('reads params a tuning supplies as a thunk', () => {
    const { deps } = setup();
    const handle = ongoing.start(ctx(deps), { params: () => ({ count: 12 }) });
    expect(count(handle.previewPose!('a'))).toBe(12);
  });
});
