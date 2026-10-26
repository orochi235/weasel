/**
 * A drawn polygon or star stays one: the insert dep keeps its parameters on
 * the node, the properties entry regenerates it when they change, and a path
 * edit turns it into plain geometry.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { pathInWorld, transformPath, translate, type PolygonPath } from '@weasel-js/geom';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { useInsertDepSource } from './insert';
import { useEditAnchorsDepSource } from './editAnchors';
import { inferredNodeProperties, defaultNodeProperties } from '../SceneCanvas/defaultNodeProperties';
import { shapeGeneratorOf } from 'domains/paths/shapeGenerator';

type Node = { id: string; pose: { x: number; y: number; width: number; height: number }; data: Record<string, unknown> };

function commit(extras: unknown, bounds = { x: 0, y: 0, width: 100, height: 100 }): Node {
  const applyOps = vi.fn();
  const scene = {
    layers: [{ id: 'default' }],
    renderOrder: () => [],
    get: () => undefined,
    mintId: () => 'n',
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
const settleOf = (name: string) =>
  [...defaultNodeProperties, ...inferredNodeProperties].find((e) => e.name === name)!.settle!;

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

  it('is made again, as one write, when the inspector changes a parameter', () => {
    const node = commit(STAR);
    for (const kind of ['star', 'path']) {
      const settle = settleOf(kind);
      const written = { pose: node.pose, data: { ...node.data, generator: { ...(node.data.generator as object), points: 8 } } };
      const settled = settle(written, { pose: node.pose, data: node.data }) as Node;
      const world = pathInWorld(settled.data.path as PolygonPath, settled.pose) as PolygonPath;
      expect(world.coords.length).toBe(8 * 2 * 2);
      expect(shapeGeneratorOf(settled.data)).toMatchObject({ points: 8 });
    }
  });

  it('becomes plain geometry when its path is edited', () => {
    const node = commit(STAR);
    const nodes = new Map([['n', { ...node, kind: 'mark' }]]);
    const scene = { layers: [{ id: 'default' }], renderOrder: () => ['n'], get: (id: NodeId) => nodes.get(id as string) } as unknown as Scene<unknown, string, unknown>;
    const sel = { current: ['n'], set: () => {} } as unknown as SelectionApi;
    let reg!: DepRegistry;
    function Wire() {
      useEditAnchorsDepSource(scene, sel, { applyOps: () => {} });
      reg = useDepRegistry();
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const dep = (reg.get as (k: string) => {
      getEditablePath(id: string): PolygonPath;
      editOps(id: string, world: unknown, label: string): { name: string; args: { to: Record<string, unknown> } }[];
    })('editAnchors');
    const moved = transformPath(dep.getEditablePath('n'), translate(5, 0));
    const data = dep.editOps('n', moved, 'Move anchors').find((op) => op.name === 'setData')!.args.to;
    expect(data.path).toBeDefined();
    expect('generator' in data).toBe(false);
    expect(data.fill).toEqual(node.data.fill);
  });
});
