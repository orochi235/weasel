import { describe, expect, it } from 'vitest';
import { createScene, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { installAvoidRouting } from './install';

type AvoidScene = Scene<unknown, 'main', RectPose>;

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

describe('the avoid follower’s first frame of a drag', () => {
  it('previews the connector as the scene holds it now, not as a drag before left it', () => {
    const scene: AvoidScene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withDiagramRegistry(),
      initial: [box('a', 0, 0), box('b', 400, 0), {
        id: 'ab', kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { diagram: { from: {}, to: {}, router: 'avoid', route: [] } },
        dependsOn: ['a', 'b'], derivePath: EDGE_DERIVE_PATH,
      }] as never,
    });
    const { follower } = installAvoidRouting(scene);
    const frame = new Map([['b', { x: 400, y: 200, width: 100, height: 60 }]]);
    follower.begin?.();
    expect(follower.preview(frame, new Map()).map((p) => p.id)).toEqual(['ab']);
    // That drag is cancelled; the connector is restyled; the next drag's first frame lands where the last one did.
    const node = scene.get('ab' as never)!;
    scene.update('ab' as never, { data: { ...(node.data as object), stroke: { width: 3 } } });
    follower.begin?.();
    const shown = follower.preview(frame, new Map()).find((p) => p.id === 'ab')!;
    expect((shown.data as { stroke?: unknown }).stroke).toEqual({ width: 3 });
  });
});
