/**
 * Simplify and Offset Path declare their params, and a commit replays from the paths as the gesture found them,
 * which is what lets the last-operation panel change one after the fact.
 */
import { describe, expect, it, vi } from 'vitest';
import { boundsOfPath, PathBuilder, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';
import { OFFSET_PATH_PARAMS, offsetPathAction, SIMPLIFY_PATH_PARAMS, simplifyPathAction } from './simplifyOffset';

const square = new PathBuilder().moveTo(0, 0).lineTo(40, 0).lineTo(40, 40).lineTo(0, 40).close().build();

function setup() {
  const node = { id: asNodeId('a'), kind: 'mark', layer: 'main', pose: square, data: {}, parent: null };
  let minted = 0;
  const scene = {
    get: (id: string) => (id === 'a' ? node : undefined),
    childrenOf: () => [],
    get roots() { return [node.id]; },
    mintId: () => asNodeId(`new-${++minted}`),
    applyBatch: vi.fn(),
  };
  const selection = { get: () => ['a'], set: vi.fn() };
  const batches: Op[][] = [];
  const deps = { scene, selection, applyOps: (ops: Op[]) => { batches.push(ops); } } as unknown as InvocationCtx['deps'];
  const ctx = (params?: Record<string, unknown>): InvocationCtx => ({
    world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps,
    ...(params ? { params } : {}),
  });
  return { batches, ctx };
}

const madePath = (ops: Op[]): PolygonPath => (ops[0]!.args as { node: { pose: PolygonPath } }).node.pose;

describe('the live path commands', () => {
  it('declare their params as forms', () => {
    expect(simplifyPathAction.params).toBe(SIMPLIFY_PATH_PARAMS);
    expect(offsetPathAction.params).toBe(OFFSET_PATH_PARAMS);
  });

  it('replay a commit with other params from the paths the gesture started on', () => {
    const { batches, ctx } = setup();
    const handle = (offsetPathAction.invoker as OngoingInvoker).start(ctx({ distance: 5 }), {});
    handle.onEnd!(ctx(), 'commit');
    expect(handle.params!()).toMatchObject({ distance: 5 });
    handle.replay!({ distance: 10, join: 'round' });
    expect(batches).toHaveLength(2);
    const [miter, round] = batches.map(madePath);
    expect(boundsOfPath(miter!)!.width).toBeCloseTo(50, 0);
    expect(boundsOfPath(round!)!.width).toBeCloseTo(60, 0);
  });

  it('turn corners as `join` asks', () => {
    const { batches, ctx } = setup();
    for (const join of ['miter', 'round'] as const) {
      const handle = (offsetPathAction.invoker as OngoingInvoker).start(ctx({ distance: 8, join }), {});
      handle.onEnd!(ctx(), 'commit');
    }
    const [miter, round] = batches.map((ops) => madePath(ops).commands.length);
    expect(round).not.toBe(miter);
  });
});
