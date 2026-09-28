import { describe, it, expect, vi } from 'vitest';
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

type TestNode = { id: string; layer: string; data: { stroke?: number } };

/** The box the test `drawOne` paints into: the pose, grown by as far as its
 *  stroke's miter spikes can reach at the default limit of 4. */
const testPaintBounds = (node: TestNode, p: Pose) => {
  const r = (node.data.stroke ?? 0) * 4;
  return { x: p.x - r, y: p.y - r, width: p.width + 2 * r, height: p.height + 2 * r };
};

function layerFor(cull: boolean | undefined, withBounds = false) {
  const scene = createScene<{ stroke?: number }, 'bg', Pose>({ systemLayers: [{ id: 'bg' }] });
  const inside = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 50, y: 50, width: 20, height: 20 }, data: {} });
  const far = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 5000, y: 50, width: 20, height: 20 }, data: {} });
  // Its box stops 10 units right of the screen; only its stroke reaches in.
  const edge = scene.add({
    kind: 'leaf', layer: 'bg', pose: { x: 410, y: 50, width: 20, height: 20 }, data: { stroke: 8 },
  });
  const drawOne = vi.fn((node: TestNode, p: Pose): DrawCommand[] => [{
        kind: 'path',
        id: node.id,
        path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
        fill: { color: '#000000' },
        ...(node.data.stroke ? { stroke: { width: node.data.stroke, paint: { color: '#000000' } } } : {}),
      } as PathDrawCommand]);
  const layer = buildSceneLayer<TestNode, Pose>(
    { cull, drawOne, ...(withBounds ? { paintBounds: testPaintBounds } : {}) },
    sceneToAdapter(scene) as never,
    null,
    () => null,
    () => null,
  );
  return { layer, inside, far, edge, scene, drawOne };
}

const paintedNodeIds = (drawOne: ReturnType<typeof vi.fn>) =>
  drawOne.mock.calls.map(([node]) => (node as TestNode).id);

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

  it('does not call the painter for a node its paint bounds put outside the view', () => {
    const { layer, inside, far, edge, drawOne } = layerFor(true, true);
    const ids = paintedIds(layer.draw(null, VIEW, DIMS) as DrawCommand[]);
    expect(paintedNodeIds(drawOne)).toEqual([inside, edge]);
    expect(paintedNodeIds(drawOne)).not.toContain(far);
    expect(ids).toEqual([inside, edge]);
  });

  it('paints a node whose rotated box reaches the view though its upright one does not', () => {
    const { layer, scene, drawOne } = layerFor(true, true);
    // Both span x 405..415 upright, clear of the 400-wide view; turned a
    // quarter about its center, the second spans x 310..510.
    const tall = scene.add({
      kind: 'leaf', layer: 'bg', pose: { x: 405, y: 100, width: 10, height: 200 }, data: {},
    });
    const turned = scene.add({
      kind: 'leaf', layer: 'bg',
      pose: { x: 405, y: 100, width: 10, height: 200, rotation: Math.PI / 2 } as Pose, data: {},
    });
    layer.draw(null, VIEW, DIMS);
    expect(paintedNodeIds(drawOne)).toContain(turned);
    expect(paintedNodeIds(drawOne)).not.toContain(tall);
  });

  it('ignores paint bounds when not asked to cull', () => {
    const { layer, inside, far, edge, drawOne } = layerFor(undefined, true);
    layer.draw(null, VIEW, DIMS);
    expect(paintedNodeIds(drawOne)).toEqual([inside, far, edge]);
  });

  it('paints a node its paint bounds cannot place', () => {
    const scene = createScene<Record<string, never>, 'bg', Pose>({ systemLayers: [{ id: 'bg' }] });
    const far = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 5000, y: 50, width: 20, height: 20 }, data: {} });
    const drawOne = vi.fn((): DrawCommand[] => []);
    const layer = buildSceneLayer<TestNode, Pose>(
      { cull: true, drawOne, paintBounds: () => null },
      sceneToAdapter(scene) as never, null, () => null, () => null,
    );
    layer.draw(null, VIEW, DIMS);
    expect(paintedNodeIds(drawOne)).toEqual([far]);
  });
});
