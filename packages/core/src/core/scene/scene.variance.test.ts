import { describe, it, expect, expectTypeOf } from 'vitest';
import type { DepSchema } from '@weasel-js/routing';
import { createScene } from './scene';
import type { Scene, SceneNode, AddNodeSpec, SceneRegistry } from '@weasel-js/core';
import type { Path } from '@weasel-js/geom';

// Every check here is enforced by `npm run typecheck`; the runtime body only
// keeps vitest from reporting an empty file.

interface MyData { label: string }
type MyLayer = 'back' | 'front';
interface MyPose { x: number; y: number; width: number; height: number; tilt: number }
/** Shares nothing with `MyPose`: a callback written against it is a mistake. */
interface OtherPose { cx: number; cy: number; r: number }

const clip = (p: MyPose): Path | null => (p.width > 0 ? null : null);
const otherClip = (p: OtherPose): Path | null => (p.r > 0 ? null : null);

function concreteScene(): Scene<MyData, MyLayer, MyPose> {
  return createScene<MyData, MyLayer, MyPose>({
    systemLayers: [{ id: 'back' }, { id: 'front' }],
    initial: [{
      kind: 'container',
      layer: 'back',
      pose: { x: 0, y: 0, width: 10, height: 10, tilt: 0 },
      data: { label: 'box' },
      clipFromPose: clip,
    }],
  });
}

describe('Scene variance', () => {
  it('a concretely typed scene is the action-facing scene without a cast', () => {
    expectTypeOf<Scene<MyData, MyLayer, MyPose>>().toMatchTypeOf<Scene<unknown, string, unknown>>();
    expectTypeOf<Scene<MyData, MyLayer, MyPose>>().toMatchTypeOf<DepSchema['scene']>();
    expectTypeOf<SceneNode<MyData, MyLayer, MyPose>>().toMatchTypeOf<SceneNode<unknown, string, unknown>>();

    const erased: DepSchema['scene'] = concreteScene();
    expect(erased.nodes.size).toBe(1);
  });

  it('still rejects a pose callback that cannot take the scene\'s pose', () => {
    const spec: AddNodeSpec<MyData, MyLayer, MyPose> = {
      kind: 'container',
      layer: 'front',
      pose: { x: 0, y: 0, width: 1, height: 1, tilt: 0 },
      data: { label: 'x' },
      // @ts-expect-error a clip written for another pose type
      clipFromPose: otherClip,
    };
    const registry: SceneRegistry<MyPose> = {
      // @ts-expect-error same, through the registry
      clipFromPose: { other: otherClip },
    };
    const scene = createScene<MyData, MyLayer, MyPose>({ systemLayers: [{ id: 'front' }], registry });
    scene.add({
      ...spec,
      // @ts-expect-error same, at `add`
      clipFromPose: otherClip,
    });
    expect(scene.nodes.size).toBe(1);
  });

  it('a registered derivation reads its node\'s and dependencies\' data typed', () => {
    const registry: SceneRegistry<MyPose, MyData, MyLayer> = {
      derivePath: {
        labeled: (node, deps) => {
          expectTypeOf(node.data.label).toEqualTypeOf<string>();
          expectTypeOf(node.layer).toEqualTypeOf<MyLayer>();
          // @ts-expect-error MyData has no `weight`
          void node.data.weight;
          const first = deps[0];
          expectTypeOf(first?.node.data.label).toEqualTypeOf<string | undefined>();
          // @ts-expect-error same, on a dependency
          void first?.node.data.weight;
          return null;
        },
      },
      derivePose: {
        tilted: (node) => (node.data.label ? node.pose : null),
      },
    };
    const scene = createScene<MyData, MyLayer, MyPose>({ systemLayers: [{ id: 'front' }], registry });
    expectTypeOf(scene).toMatchTypeOf<Scene<unknown, string, unknown>>();
    expect(scene.nodes.size).toBe(0);
  });
});
