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

  it('reports a committed pose move as changed', () => {
    const { scene, id } = makeScene();
    const feed = createPoseFeed(scene);
    feed.read();

    scene.setPose(id, { x: 5, y: 5, width: 10, height: 10 });
    const delta = feed.read();

    expect(delta.reset).toBe(false);
    expect(delta.changed.map((n) => n.node.id)).toEqual([id]);
    expect(delta.changed[0]!.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    expect(delta.added).toEqual([]);
  });

  it('reports an insert as added and a delete as removed', () => {
    const { scene, id } = makeScene();
    const feed = createPoseFeed(scene);
    feed.read();

    const second = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'b' } });
    expect(feed.read().added.map((n) => n.node.id)).toEqual([second]);

    scene.remove(id);
    const delta = feed.read();

    expect(delta.removed).toEqual([id]);
    expect(delta.added).toEqual([]);
    expect(delta.changed).toEqual([]);
  });

  it('reports an undo the same way as the edit it reverses', () => {
    const { scene, id } = makeScene();
    const feed = createPoseFeed(scene);
    feed.read();
    scene.setPose(id, { x: 5, y: 5, width: 10, height: 10 });
    feed.read();

    scene.undo();
    const delta = feed.read();

    expect(delta.changed.map((n) => n.node.id)).toEqual([id]);
    expect(delta.changed[0]!.pose).toEqual(POSE);
  });
});
