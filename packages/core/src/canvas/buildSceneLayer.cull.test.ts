import { describe, it, expect } from 'vitest';
import { buildSceneLayer } from './Canvas';
import type { DrawCommand, PathDrawCommand } from '../renderer';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

type Pose = { x: number; y: number; width: number; height: number };

const DIMS = { width: 400, height: 300 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Every path command in the layer's output, by the node id it came from. */
function paintedIds(cmds: DrawCommand[]): string[] {
  const ids: string[] = [];
  const walk = (c: DrawCommand): void => {
    if (c.kind === 'group') c.children.forEach(walk);
    else if (c.kind === 'path') ids.push((c as PathDrawCommand & { id: string }).id);
  };
  cmds.forEach(walk);
  return ids;
}

function layerFor(cull: boolean | undefined) {
  const scene = createScene<{ stroke?: number }, 'bg', Pose>({ systemLayers: [{ id: 'bg' }] });
  const inside = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 50, y: 50, width: 20, height: 20 }, data: {} });
  const far = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 5000, y: 50, width: 20, height: 20 }, data: {} });
  // Its box stops 10 units right of the screen; only its stroke reaches in.
  const edge = scene.add({
    kind: 'leaf', layer: 'bg', pose: { x: 410, y: 50, width: 20, height: 20 }, data: { stroke: 8 },
  });
  const layer = buildSceneLayer<{ id: string; layer: string; data: { stroke?: number } }, Pose>(
    {
      cull,
      drawOne: (node, p) => [{
        kind: 'path',
        id: node.id,
        path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
        fill: { color: '#000000' },
        ...(node.data.stroke ? { stroke: { width: node.data.stroke, paint: { color: '#000000' } } } : {}),
      } as PathDrawCommand],
    },
    sceneToAdapter(scene) as never,
    null,
    () => null,
    () => null,
  );
  return { layer, inside, far, edge };
}

describe('buildSceneLayer — cull', () => {
  it('emits no command for a node far outside the view, and keeps one whose stroke reaches in', () => {
    const { layer, inside, far, edge } = layerFor(true);
    const ids = paintedIds(layer.draw(null, VIEW, DIMS) as DrawCommand[]);
    expect(ids).toEqual([inside, edge]);
    expect(ids).not.toContain(far);
  });

  it('culls against the view it is drawn under', () => {
    const { layer, inside, far } = layerFor(true);
    const panned = { x: 4900, y: 0, scale: { x: 1, y: 1 } };
    expect(paintedIds(layer.draw(null, panned, DIMS) as DrawCommand[])).toEqual([far]);
    expect(paintedIds(layer.draw(null, VIEW, DIMS) as DrawCommand[])).toContain(inside);
  });

  it('paints everything when not asked to cull', () => {
    const { layer, inside, far, edge } = layerFor(undefined);
    expect(paintedIds(layer.draw(null, VIEW, DIMS) as DrawCommand[])).toEqual([inside, far, edge]);
  });
});
