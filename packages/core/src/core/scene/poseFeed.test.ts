import { describe, expect, it } from 'vitest';
import { createPoseFeed } from './poseFeed';
import { createScene } from './scene';
import type { NodeId } from './types';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function makeScene() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id: NodeId = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
  return { scene, id };
}

describe('createPoseFeed', () => {
  it('reports reset and every node on the first read', () => {
    const { scene, id } = makeScene();
    const feed = createPoseFeed(scene);

    const delta = feed.read();

    expect(delta.reset).toBe(true);
    expect(delta.added.map((n) => n.node.id)).toEqual([id]);
    expect(delta.added[0]!.pose).toEqual(POSE);
    expect(delta.removed).toEqual([]);
    expect(delta.changed).toEqual([]);
  });

  it('reports nothing on a second read with no change', () => {
    const { scene } = makeScene();
    const feed = createPoseFeed(scene);
    feed.read();

    const delta = feed.read();

    expect(delta.reset).toBe(false);
    expect(delta.added).toEqual([]);
    expect(delta.removed).toEqual([]);
    expect(delta.changed).toEqual([]);
  });
});
