import { describe, expect, it } from 'vitest';
import { createScene, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import type { DiagramEdge } from '../edgeTrait';
import { installAvoidRouting } from './install';
import { avoidSceneInput } from './sceneInput';
import * as ops from '@weasel-js/core/ops';

type AvoidScene = Scene<unknown, 'main', RectPose>;

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

function load() {
  const scene: AvoidScene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [box('a', 0, 0), box('b', 400, 0), box('wall', 200, 300, 60, 260), {
      id: 'ab', kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, router: 'avoid', route: [] } },
      dependsOn: ['a', 'b'], derivePath: EDGE_DERIVE_PATH,
    }] as never,
  });
  const routing = installAvoidRouting(scene);
  const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose) };
  // The wall moves across the route, which reroutes round it; undo puts both back.
  scene.applyBatch([ops.setPose({ id: 'wall', from: scene.get('wall' as never)!.pose, to: { x: 200, y: -100, width: 60, height: 260 } })], 'Move', adapter);
  return { scene, routing };
}

const routeIn = (data: unknown) => (data as { diagram: DiagramEdge }).diagram.route!;

describe('avoid routing after undo and redo', () => {
  // A router holding what the scene holds reroutes nothing for it.
  it('holds the shapes and routes undo left', () => {
    const { scene, routing } = load();
    scene.undo();
    expect(routeIn(scene.get('ab' as never)!.data)).toEqual([]);
    expect([...routing.router.update(avoidSceneInput(scene)).keys()]).toEqual([]);
  });

  it('holds the shapes and routes redo left', () => {
    const { scene, routing } = load();
    scene.undo();
    scene.redo();
    expect(routeIn(scene.get('ab' as never)!.data).length).toBeGreaterThan(0);
    expect([...routing.router.update(avoidSceneInput(scene)).keys()]).toEqual([]);
  });

  it('holds what a jump through history left', () => {
    const { scene, routing } = load();
    scene.jumpToHistoryIndex(0);
    expect([...routing.router.update(avoidSceneInput(scene)).keys()]).toEqual([]);
  });
});
