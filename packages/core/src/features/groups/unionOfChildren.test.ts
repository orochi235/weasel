import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { effectivePose } from 'core/scene/effectivePose';
import { UNION_OF_CHILDREN } from 'core/scene/kitRegistry';
import { unionOfChildrenVia } from './unionOfChildren';
import {
  circle,
  CIRCLE_POSE_DESCRIPTOR,
  type CirclePose,
} from 'interactions/actions/resize/circlePose.fixture';

describe('unionOfChildrenVia', () => {
  it('unions circles through a descriptor', () => {
    const union = unionOfChildrenVia(CIRCLE_POSE_DESCRIPTOR);
    const scene = createScene<object, 'main', CirclePose>({
      systemLayers: [{ id: 'main' as const }],
      registry: { derivePose: { [UNION_OF_CHILDREN]: union } },
    });
    const g = scene.add({
      kind: 'container', layer: 'main', pose: circle(0, 0, 0), data: {},
      dependsOn: 'children', derivePose: union,
    });
    scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: circle(0, 0, 10), data: {} });
    scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: circle(40, 0, 10), data: {} });
    expect(effectivePose(scene, scene.get(g)!)).toEqual(circle(20, 0, 10));
  });

  it('returns null for an emptied container', () => {
    const union = unionOfChildrenVia(CIRCLE_POSE_DESCRIPTOR);
    expect(union({ pose: circle(0, 0, 0) }, [])).toBeNull();
  });
});
