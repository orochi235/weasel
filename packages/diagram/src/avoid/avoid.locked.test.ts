import { describe, expect, it } from 'vitest';
import { createScene, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import type { DiagramEdge } from '../edgeTrait';
import { installAvoidRouting } from './install';

type AvoidScene = Scene<unknown, 'main', RectPose>;

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

const routeOf = (scene: AvoidScene) => (scene.get('ab' as never)!.data as { diagram: DiagramEdge }).diagram.route;

describe('avoid routing a locked connector', () => {
  it('reroutes it on the first edit after it is unlocked, when an edit while locked disturbed it', () => {
    const scene: AvoidScene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withDiagramRegistry(),
      initial: [box('a', 0, 0), box('b', 400, 0), {
        id: 'ab', kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { diagram: { from: {}, to: {}, router: 'avoid', route: [] } },
        dependsOn: ['a', 'b'], derivePath: EDGE_DERIVE_PATH,
      }] as never,
    });
    installAvoidRouting(scene);
    scene.setLocked('ab' as never, true);
    scene.add(box('wall', 200, -100, 60, 260) as never);
    expect(routeOf(scene)).toEqual([]);
    scene.setLocked('ab' as never, false);
    scene.add(box('far', 3000, 3000) as never);
    expect(routeOf(scene)!.length).toBeGreaterThan(0);
  });
});
