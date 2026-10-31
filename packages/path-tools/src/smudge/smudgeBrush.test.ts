import { describe, expect, it, vi } from 'vitest';
import { pathFromD, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { asNodeId, type NodeId, type Op } from '@weasel-js/core';
import { brushRingCursor } from '../simplifyBrush/simplifyBrush';
import { DEFAULT_SMUDGE_RADIUS_PX, smudgeBrushAction } from './smudgeBrush';

/** One node storing its polygon as the pose, selected, at a view scale of `zoom`. */
function setup(d: string, zoom = 1) {
  const node = { id: asNodeId('a'), kind: 'mark', layer: 'main', pose: pathFromD(d), data: {}, parent: null };
  const scene = { get: (id: NodeId) => (id === node.id ? node : undefined), childrenOf: () => [] };
  const selection = { get: () => ['a'], set: vi.fn() };
  const view = { get: () => ({ scale: { x: zoom, y: zoom } }) };
  const batches: Array<{ ops: Op[]; label: string }> = [];
  const applyOps = vi.fn((ops: Op[], label: string) => { batches.push({ ops, label }); });
  return { deps: { scene, selection, view, applyOps } as never, batches };
}

const at = (deps: never, x: number, y: number, params?: Record<string, unknown>) =>
  ({ deps, world: { x, y }, ...(params ? { params } : {}) }) as unknown as InvocationCtx;
const invoker = smudgeBrushAction.invoker as OngoingInvoker;

describe('smudgeBrushAction', () => {
  it('pushes the edge under the brush along the stroke, as one undo step', () => {
    const { deps, batches } = setup('M0 0 H100 V100 H0 Z');
    const handle = invoker.start(at(deps, 50, 0), { params: { radiusPx: 20, strength: 1 } });
    handle.onMove!(at(deps, 50, -5));
    handle.onMove!(at(deps, 50, -10));
    expect(handle.previewIds!()).toEqual(['a']);
    handle.onEnd!(at(deps, 50, -10), 'commit');
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Smudge brush');
    const pushed = pathToAnchors((batches[0].ops[0].args as { to: PolygonPath }).to).anchors[0];
    expect(pushed.length).toBeGreaterThan(4);
    expect(Math.min(...pushed.map((p) => p.y))).toBeLessThan(-5);
  });

  it('leaves the path as it was when the stroke is canceled', () => {
    const { deps, batches } = setup('M0 0 H100 V100 H0 Z');
    const handle = invoker.start(at(deps, 50, 0), {});
    handle.onMove!(at(deps, 50, -10));
    handle.onEnd!(at(deps, 50, -10), 'cancel');
    expect(batches).toHaveLength(0);
  });

  it('measures its radius on screen, so zooming in shrinks its reach on the page', () => {
    const { deps, batches } = setup('M0 0 H100 V100 H0 Z', 4);
    // 20 screen px at 4× is 5 units: a stroke 8 units off the edge never meets it.
    const handle = invoker.start(at(deps, 50, 8), { params: { radiusPx: 20 } });
    handle.onMove!(at(deps, 50, 12));
    handle.onEnd!(at(deps, 50, 12), 'commit');
    expect(batches).toHaveLength(0);
  });

  it('shows a ring the size of the brush, before the press and through the stroke', () => {
    const cursor = smudgeBrushAction.cursor as (p?: Record<string, unknown>) => unknown;
    expect(cursor({ radiusPx: 25 })).toEqual(brushRingCursor(25));
    expect(cursor(undefined)).toEqual(brushRingCursor(DEFAULT_SMUDGE_RADIUS_PX));
    const { deps } = setup('M0 0 H100 V100 H0 Z');
    let radiusPx = 10;
    const handle = invoker.start(at(deps, 50, 0), { params: () => ({ radiusPx }) });
    expect(handle.cursor!()).toEqual(brushRingCursor(10));
    radiusPx = 30;
    handle.onMove!(at(deps, 50, -2));
    expect(handle.cursor!()).toEqual(brushRingCursor(30));
  });

  it('with nothing selected, pushes every path under the brush but locked and hidden ones', () => {
    const mk = (id: string) => ({ id: asNodeId(id), kind: 'mark', layer: 'main', pose: pathFromD('M0 0 H100 V100 H0 Z'), data: {}, parent: null });
    const nodes = [mk('free'), mk('locked'), mk('hidden')];
    const scene = {
      get: (id: NodeId) => nodes.find((n) => n.id === id),
      childrenOf: () => [],
      renderOrderNodes: () => nodes,
      isLocked: (id: string) => id === 'locked',
      isHidden: (id: string) => id === 'hidden',
    };
    const deps = { scene, selection: { get: () => [], set: vi.fn() }, view: { get: () => ({ scale: { x: 1, y: 1 } }) }, applyOps: vi.fn() } as never;
    expect(smudgeBrushAction.enabled!(deps)).toBe(true);
    const handle = invoker.start(at(deps, 50, 0), { params: { radiusPx: 20, strength: 1 } });
    handle.onMove!(at(deps, 50, -10));
    expect(handle.previewIds!()).toEqual(['free']);
  });
});
