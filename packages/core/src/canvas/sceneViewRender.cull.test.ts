import { describe, expect, it, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { DrawCommand } from '../renderer/DrawCommand';
import { buildSceneViewCommands } from './sceneViewRender';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';

type Pose = { x: number; y: number; width: number; height: number };

function world() {
  const scene = createScene<{ shape: 'rect' }, 'bg', Pose>({ systemLayers: [{ id: 'bg' }] });
  const inside = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 50, y: 50, width: 20, height: 20 }, data: { shape: 'rect' } });
  const far = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 5000, y: 50, width: 20, height: 20 }, data: { shape: 'rect' } });
  const drawOne = vi.fn(defaultDrawOne) as unknown as typeof defaultDrawOne;
  const painted = () => (drawOne as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([n]) => (n as { id: string }).id);
  return { scene, inside, far, drawOne, painted };
}

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const EXTRA: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 9000, y: 0, width: 1, height: 1 } };

describe('buildSceneViewCommands — cull', () => {
  it('does not paint a node its paint bounds put outside the view, and keeps extras', () => {
    const { scene, inside, drawOne, painted } = world();
    const [root] = buildSceneViewCommands(
      scene, VIEW, drawOne, [EXTRA], undefined, undefined, undefined, undefined,
      { width: 400, height: 300, paintBounds: defaultPaintBounds },
    );
    expect(painted()).toEqual([inside]);
    expect((root as { children: DrawCommand[] }).children).toContain(EXTRA);
  });

  it('paints every node when not asked to cull', () => {
    const { scene, inside, far, drawOne, painted } = world();
    buildSceneViewCommands(scene, VIEW, drawOne);
    expect(painted()).toEqual([inside, far]);
  });
});
