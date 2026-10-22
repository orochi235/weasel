/**
 * A derived node's pose is a placeholder; marquee and lasso test the path it
 * derives, the way the point query does.
 */
import { describe, it, expect } from 'vitest';
import { linePath, type Path } from '@weasel-js/geom';
import { hitTestArea, hitTestLassoPolygon } from './hitTestArea';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';

type P = { x: number; y: number; width: number; height: number };
const box = (x: number, y: number): P => ({ x, y, width: 10, height: 10 });

function edgeScene(
  derive: (from: P, to: P) => Path = (from, to) => linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y }),
  parent?: NodeId,
): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'default', P>({
    systemLayers: [{ id: 'default' }],
    initial: [
      ...(parent ? [{
        id: parent, kind: 'container', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
        clipFromPose: () => ({ kind: 'rect', x: 0, y: 490, width: 150, height: 30 }),
      }] : []),
      { id: 'a' as NodeId, kind: 'leaf', layer: 'default', pose: box(0, 500), data: {} },
      { id: 'b' as NodeId, kind: 'leaf', layer: 'default', pose: box(200, 500), data: {} },
      {
        id: 'edge' as NodeId, kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 },
        data: {}, ...(parent ? { parent } : {}), dependsOn: ['a' as NodeId, 'b' as NodeId],
        derivePath: (_n: unknown, deps: readonly ({ pose: P } | undefined)[]) => {
          const [from, to] = [deps[0]?.pose, deps[1]?.pose];
          return from && to ? derive(from, to) : null;
        },
      },
    ] as never,
  });
  return scene as unknown as Scene<unknown, string, unknown>;
}

const around = (x: number, y: number) => [
  { x, y }, { x: x + 10, y }, { x: x + 10, y: y + 10 }, { x, y: y + 10 },
];

describe('hitTestArea — a derived node', () => {
  it('marquee takes a derived node where its path is painted, not at its placeholder pose', () => {
    const scene = edgeScene();
    expect(hitTestArea(scene, { x: 95, y: 495, width: 10, height: 10 })).toContain('edge');
    expect(hitTestArea(scene, { x: -5, y: -5, width: 10, height: 10 })).not.toContain('edge');
  });

  it('lasso takes a derived node by its path too', () => {
    const scene = edgeScene();
    expect(hitTestLassoPolygon(scene, around(95, 495), 'intersect')).toContain('edge');
    expect(hitTestLassoPolygon(scene, around(-5, -5), 'intersect')).not.toContain('edge');
  });

  it('reads a non-polygon derived path as the node\'s outline, leaving the placeholder pose to the painter', () => {
    const scene = edgeScene((from, to) => ({ kind: 'rect', x: from.x, y: from.y, width: to.x - from.x, height: 20 }));
    expect(hitTestArea(scene, { x: 95, y: 495, width: 10, height: 10 })).toContain('edge');
    expect(hitTestArea(scene, { x: -5, y: -5, width: 10, height: 10 })).not.toContain('edge');
  });

  it('gates a derived node by its container\'s clip at the path, not the placeholder', () => {
    const scene = edgeScene(undefined, 'box' as NodeId);
    expect(hitTestArea(scene, { x: 95, y: 495, width: 10, height: 10 })).toContain('edge');
    expect(hitTestArea(scene, { x: 195, y: 495, width: 10, height: 10 })).not.toContain('edge');
  });
});
