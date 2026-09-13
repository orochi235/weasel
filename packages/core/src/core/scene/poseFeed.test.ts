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

  it('reports an override as changed, at the overridden pose', () => {
    const { scene, id } = makeScene();
    const feed = createPoseFeed(scene);
    feed.read();

    scene.overrides.set(id, { pose: { x: 99, y: 0, width: 10, height: 10 } });
    scene.overrides.commit();
    const delta = feed.read();

    expect(delta.changed.map((n) => n.node.id)).toEqual([id]);
    expect(delta.changed[0]!.pose).toEqual({ x: 99, y: 0, width: 10, height: 10 });
    expect(delta.changed[0]!.node.pose).toEqual(POSE); // committed pose still reachable
  });

  it('reports a node once when both clocks moved in the same frame', () => {
    const { scene, id } = makeScene();
    const feed = createPoseFeed(scene);
    feed.read();

    scene.setPose(id, { x: 5, y: 5, width: 10, height: 10 });
    scene.overrides.set(id, { pose: { x: 99, y: 0, width: 10, height: 10 } });
    scene.overrides.commit();
    const delta = feed.read();

    expect(delta.changed).toHaveLength(1);
    expect(delta.changed[0]!.pose).toEqual({ x: 99, y: 0, width: 10, height: 10 });
    expect(delta.changed[0]!.node.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });

  it('reports a derived node as changed when the node it depends on moves', () => {
    // Verified empirically 2026-09-13: `kit:setPose` calls `invalidateDependents`,
    // which drops the dependent's pose-keyed memo slot, so the next
    // `effectivePose` recomputes to a fresh reference the walk's `!==` catches.
    // Nothing about the derived node itself changes, so without this the feed
    // would silently leave a connector painted at its old position.
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const a: NodeId = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
    const b: NodeId = scene.add({
      kind: 'leaf',
      layer: 'main',
      pose: POSE,
      data: { label: 'b' },
      dependsOn: [a],
      derivePose: (_node, deps) => deps[0]?.pose ?? POSE,
    });
    const feed = createPoseFeed(scene);
    feed.read();

    scene.setPose(a, { x: 50, y: 50, width: 10, height: 10 });
    const delta = feed.read();

    expect(delta.changed.map((n) => n.node.id).sort()).toEqual([a, b].sort());
    expect(delta.changed.find((n) => n.node.id === b)!.pose).toEqual({
      x: 50, y: 50, width: 10, height: 10,
    });
  });

  it('reports a cleared override as changed, back at the committed pose', () => {
    const { scene, id } = makeScene();
    const feed = createPoseFeed(scene);
    feed.read();
    scene.overrides.set(id, { pose: { x: 99, y: 0, width: 10, height: 10 } });
    scene.overrides.commit();
    feed.read();

    scene.overrides.clearAll();
    scene.overrides.commit();
    const delta = feed.read();

    expect(delta.changed.map((n) => n.node.id)).toEqual([id]);
    expect(delta.changed[0]!.pose).toEqual(POSE);
  });

  it('does not walk the node map for an override-only frame', () => {
    const { scene, id } = makeScene();
    let iterations = 0;
    // A proxy over the live map: `for…of scene.nodes` reads Symbol.iterator, so
    // counting that read observes the walk itself, not a stand-in for it.
    const realNodes = scene.nodes;
    Object.defineProperty(scene, 'nodes', {
      configurable: true,
      get: () =>
        new Proxy(realNodes, {
          get(target, prop, recv) {
            // A native Map's Symbol.iterator requires a real Map receiver, so
            // forwarding it via `recv` (the Proxy) throws "incompatible
            // receiver" — bind it to `target` instead of the usual forward.
            if (prop === Symbol.iterator) {
              iterations++;
              return target[Symbol.iterator].bind(target);
            }
            return Reflect.get(target, prop, recv);
          },
        }),
    });

    const feed = createPoseFeed(scene);
    feed.read();
    const baseline = iterations;

    for (let frame = 0; frame < 60; frame++) {
      scene.overrides.set(id, { pose: { x: frame, y: 0, width: 10, height: 10 } });
      scene.overrides.commit();
      feed.read();
    }

    expect(iterations).toBe(baseline);
  });

  it('resets when render order changed without any node changing', () => {
    const { scene, id } = makeScene();
    const second = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'b' } });
    const feed = createPoseFeed(scene);
    feed.read();

    scene.reorder(second, 0);
    const delta = feed.read();

    // The delta carries no order of its own — `added` follows `scene.nodes`,
    // which is insertion order and does not move on a reorder. `reset` is the
    // whole signal: it tells the host to re-read `renderOrderNodes()`.
    expect(delta.reset).toBe(true);
    expect([...delta.added.map((n) => n.node.id)].sort()).toEqual([id, second].sort());
  });

  it('repaints a reparented node rather than losing it', () => {
    const { scene, id } = makeScene();
    const parent: NodeId = scene.add({
      kind: 'container', layer: 'main', pose: POSE, data: { label: 'p' },
    });
    const feed = createPoseFeed(scene);
    feed.read();

    scene.move(id, parent);
    const delta = feed.read();

    expect(delta.removed).not.toContain(id);
    expect(delta.reset || delta.changed.some((n) => n.node.id === id)).toBe(true);
  });
});
