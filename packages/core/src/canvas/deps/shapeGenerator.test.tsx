/**
 * A drawn star stays one: the properties entry regenerates it when its parameters change, and a path edit turns it
 * into plain geometry.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { pathInWorld, starPath, transformPath, translate, type PolygonPath } from '@weasel-js/geom';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from '@weasel-js/routing';
import { useEditAnchorsDepSource } from './editAnchors';
import { inferredNodeProperties, defaultNodeProperties } from '../SceneCanvas/defaultNodeProperties';
import { shapeGeneratorOf } from 'domains/paths/shapeGenerator';
import { solid } from '../../util/paint';

type Node = { id: string; pose: { x: number; y: number; width: number; height: number }; data: Record<string, unknown> };

/** A star as the insert dep draws one from `STAR`: its path around the circle it was dragged out on, and the
 *  parameters it keeps. */
function drawnStar(): Node {
  return {
    id: 'n',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: {
      path: starPath({ x: 50, y: 50 }, 50, 5, 20, 0.3),
      generator: { kind: 'star', points: 5, innerRadiusRatio: 0.4, rotation: 0.3 },
      fill: { paint: solid('#3366ff') },
    },
  };
}

const settleOf = (name: string) =>
  [...defaultNodeProperties, ...inferredNodeProperties].find((e) => e.name === name)!.settle!;

describe('a drawn star or polygon', () => {
  it('is made again, as one write, when the inspector changes a parameter', () => {
    const node = drawnStar();
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
    const node = drawnStar();
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
