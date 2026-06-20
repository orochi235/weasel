/**
 * Focused unit test for the opt-in `geometryProjection` seam.
 *
 * Drives the real `nudgeRightAction` over a stub scene with a setData-capable
 * adapter and asserts the two halves of the opt-in contract:
 *   - dep present  → the node's `data.path` is rewritten by the consumer
 *     transform (a committed `setData` op runs through the adapter).
 *   - dep absent   → `data` is left untouched and no `setData` op is emitted.
 */

import { describe, it, expect } from 'vitest';
import type { Mat3 } from '@weasel-js/geom';
import { transformPath, rectPath, boundsOfPath } from 'features/paths';
import type { Path } from 'features/paths/types';
import { nudgeRightAction } from '../defaults/nudge';
import type { ImmediateInvoker } from '../invoker';
import type { Op } from 'core/ops/types';

function setup(path: Path) {
  const b = boundsOfPath(path);
  const pose = { x: b.x, y: b.y, width: b.width, height: b.height };
  const poses = new Map<string, unknown>([['n', pose]]);
  const datas = new Map<string, { path: Path }>([['n', { path }]]);
  const scene = {
    get: (id: string) => poses.has(id)
      ? { pose: poses.get(id), data: datas.get(id), kind: 'leaf', layer: 'default', parent: null }
      : undefined,
    setPose: (id: string, p: unknown) => poses.set(id, p),
    renderOrder: () => ['n'], childrenOf: () => [], roots: ['n'],
  };
  const adapter = {
    setPose: (id: string, p: unknown) => poses.set(id, p),
    setData: (id: string, d: { path: Path }) => datas.set(id, d),
  };
  const applyOps = (ops: Op[]) => { for (const op of ops) op.apply(adapter); };
  return { scene, datas, applyOps };
}

describe('geometryProjection seam', () => {
  it('rewrites data.path via the consumer transform when the dep is present', () => {
    const path = rectPath(0, 0, 10, 10);
    const { scene, datas, applyOps } = setup(path);
    const geometryProjection = {
      transform: (node: { data: { path: Path } }, m: Mat3) => ({ ...node.data, path: transformPath(node.data.path, m) }),
    };
    (nudgeRightAction.invoker as ImmediateInvoker).run(
      { selection: { get: () => ['n'] }, scene, applyOps, geometryProjection } as never,
      { magnitude: 'small' },
    );
    expect(boundsOfPath(datas.get('n')!.path).x).toBeCloseTo(1, 6);
  });

  it('leaves data.path untouched when the dep is absent', () => {
    const path = rectPath(0, 0, 10, 10);
    const { scene, datas, applyOps } = setup(path);
    (nudgeRightAction.invoker as ImmediateInvoker).run(
      { selection: { get: () => ['n'] }, scene, applyOps } as never,
      { magnitude: 'small' },
    );
    expect(datas.get('n')!.path).toBe(path);
  });
});
