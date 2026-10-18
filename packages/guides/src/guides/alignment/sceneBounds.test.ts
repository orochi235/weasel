import { describe, expect, it } from 'vitest';
import { createScene, type NodeId } from '@weasel-js/core';
import { siblingBounds, worldBoundsOf, worldUnionOf } from './sceneBounds';

type Pose = { x: number; y: number; width: number; height: number; rotation?: number };
const box = (x: number, y: number, width = 10, height = 10): Pose => ({ x, y, width, height });

function fixture() {
  const scene = createScene<object, 'main' | 'off', Pose>({
    systemLayers: [{ id: 'main', visible: true, locked: false }, { id: 'off', visible: false, locked: false }],
  });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: box(30, 0), data: {} });
  const hidden = scene.add({ kind: 'leaf', layer: 'off', pose: box(60, 0), data: {} });
  const g = scene.add({ kind: 'container', layer: 'main', pose: box(100, 100, 50, 50), data: {} });
  const inner = scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: box(110, 110), data: {} });
  const innerB = scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: box(130, 110), data: {} });
  return { scene, a, b, hidden, g, inner, innerB };
}

describe('siblingBounds', () => {
  it('reads the other nodes under the same parent, skipping hidden layers and the moving ids', () => {
    const { scene, a, b, g } = fixture();
    expect(siblingBounds(scene, [a])).toEqual([box(30, 0), box(100, 100, 50, 50)]);
    expect(siblingBounds(scene, [a, b, g])).toEqual([]);
  });

  it('skips a hidden sibling', () => {
    const { scene, a, b } = fixture();
    scene.setHidden(b, true);
    expect(siblingBounds(scene, [a])).toEqual([box(100, 100, 50, 50)]);
  });

  it('stays inside a group for a node inside it', () => {
    const { scene, inner } = fixture();
    expect(siblingBounds(scene, [inner])).toEqual([box(130, 110)]);
  });
});

describe('worldBoundsOf / worldUnionOf', () => {
  it('reads a turned node by its drawn extent, and unions several', () => {
    const { scene, a, b } = fixture();
    scene.setPose(a, { ...box(0, 0, 20, 10), rotation: Math.PI / 2 });
    const [turned] = worldBoundsOf(scene, [a]);
    expect(turned.x).toBeCloseTo(5);
    expect(turned.y).toBeCloseTo(-5);
    expect(turned.width).toBeCloseTo(10);
    expect(turned.height).toBeCloseTo(20);
    expect(worldUnionOf(scene, [b, 'gone' as NodeId])).toEqual(box(30, 0));
    expect(worldUnionOf(scene, [])).toBeNull();
  });
});
