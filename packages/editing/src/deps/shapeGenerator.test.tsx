/**
 * A drawn polygon or star keeps the parameters it was drawn with on the node.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { pathInWorld, type PolygonPath } from '@weasel-js/geom';
import { shapeGeneratorOf, type Scene } from '@weasel-js/core';
import { useInsertDepSource } from './insert';

type Node = { id: string; pose: { x: number; y: number; width: number; height: number }; data: Record<string, unknown> };

function commit(extras: unknown, bounds = { x: 0, y: 0, width: 100, height: 100 }): Node {
  const applyOps = vi.fn();
  const scene = {
    layers: [{ id: 'default' }],
    renderOrder: () => [],
    get: () => undefined,
    mintId: () => 'n',
    roots: [],
  } as unknown as Scene<unknown, string, unknown>;
  let reg!: DepRegistry;
  function Wire() {
    useInsertDepSource(scene, { applyOps });
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  (reg.get as (k: string) => { commit(b: unknown, e: unknown): unknown })('insert').commit(bounds, extras);
  return applyOps.mock.calls[0][0][0].args.node as Node;
}

const STAR = { kind: 'star', points: 5, innerRadiusRatio: 0.4, rotation: 0.3, center: { x: 50, y: 50 }, outerRadius: 50 };

describe('a drawn star or polygon', () => {
  it('keeps the parameters it was drawn with', () => {
    expect(shapeGeneratorOf(commit(STAR).data)).toEqual({ kind: 'star', points: 5, innerRadiusRatio: 0.4, rotation: 0.3 });
    expect(shapeGeneratorOf(commit({ kind: 'polygon', sides: 7, rotation: 0 }).data))
      .toEqual({ kind: 'polygon', sides: 7, rotation: 0 });
  });

  it('is drawn on the circle it was dragged out on, not stretched to that circle\'s box', () => {
    const node = commit(STAR);
    const world = pathInWorld(node.data.path as PolygonPath, node.pose) as PolygonPath;
    for (let i = 0; i < world.coords.length; i += 4) {
      expect(Math.hypot(world.coords[i] - 50, world.coords[i + 1] - 50)).toBeCloseTo(50, 3);
    }
  });

});
