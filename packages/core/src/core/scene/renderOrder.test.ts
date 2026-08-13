/**
 * Differential test for `renderOrder()` and `renderOrderNodes()`.
 *
 * `legacyRenderOrder` below is a transcription of the original layer-major
 * implementation — one full DFS of the tree per layer, yielding only the nodes
 * whose layer matched that pass. The live implementation buckets in a single
 * pass instead, and takes a separate branch when there is exactly one layer.
 * This file exists to hold all of them to the same sequence forever, because
 * render order drives painting and hit-testing: a divergence surfaces as a
 * z-order bug or a node that cannot be clicked, not as a crash.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import type { NodeId, Scene } from './types';

type Data = { n: number };
type AnyScene = Scene<Data, string, unknown>;

const POSE = { x: 0, y: 0, width: 10, height: 10 };

/** The pre-2026-08 implementation: one whole-tree DFS per layer. */
function legacyRenderOrder(scene: AnyScene): NodeId[] {
  const out: NodeId[] = [];
  for (const layer of scene.layers) {
    const stack: NodeId[] = [...scene.roots].reverse();
    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = scene.get(id);
      if (!node) continue;
      if (node.layer === layer.id) out.push(id);
      if (node.kind === 'container') {
        const kids = scene.childrenOf(id);
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      }
    }
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sceneWithLayers(count: number): AnyScene {
  return createScene<Data, string, unknown>({
    systemLayers: Array.from({ length: count }, (_, i) => ({ id: `L${i}` })),
  });
}

function agree(scene: AnyScene, what: string): NodeId[] {
  const actual = [...scene.renderOrder()];
  expect(actual, what).toEqual(legacyRenderOrder(scene));
  expect(scene.renderOrderNodes().map((n) => n.id), `${what} (nodes)`).toEqual(actual);
  return actual;
}

/**
 * A scene of `nodes` nodes over `layers` layers, grown by repeatedly attaching
 * to a randomly chosen existing container (or a root). A child may never sit
 * below its parent's layer, so each node's layer is drawn from the range at or
 * above its parent's — which is exactly the case where layer-major order and
 * tree order disagree, and therefore the case worth generating.
 */
function randomScene(seed: number, layers: number, nodes: number): AnyScene {
  const rnd = mulberry32(seed);
  const scene = sceneWithLayers(layers);
  const containers: Array<{ id: NodeId | null; layerIndex: number }> = [
    { id: null, layerIndex: 0 },
  ];
  for (let n = 0; n < nodes; n++) {
    const slot = containers[Math.floor(rnd() * containers.length)];
    const layerIndex = slot.layerIndex
      + Math.floor(rnd() * (layers - slot.layerIndex));
    const kind = rnd() < 0.3 ? 'container' : 'leaf';
    const id = scene.add({
      kind,
      layer: `L${layerIndex}`,
      pose: POSE,
      data: { n },
      ...(slot.id !== null ? { parent: slot.id } : {}),
    });
    if (kind === 'container') containers.push({ id, layerIndex });
  }
  return scene;
}

describe('renderOrder — single-pass bucketing matches the layer-major walk', () => {
  it('empty scene', () => {
    expect(agree(sceneWithLayers(3), 'empty')).toEqual([]);
  });

  it('single node', () => {
    const s = sceneWithLayers(1);
    const a = s.add({ kind: 'leaf', layer: 'L0', pose: POSE, data: { n: 0 } });
    expect(agree(s, 'single')).toEqual([a]);
  });

  it('multiple roots on one layer keep insertion order', () => {
    const s = sceneWithLayers(1);
    const ids = [0, 1, 2, 3].map((n) =>
      s.add({ kind: 'leaf', layer: 'L0', pose: POSE, data: { n } }));
    expect(agree(s, 'multi-root')).toEqual(ids);
  });

  it('empty layers contribute nothing', () => {
    const s = sceneWithLayers(8);
    const a = s.add({ kind: 'leaf', layer: 'L7', pose: POSE, data: { n: 0 } });
    const b = s.add({ kind: 'leaf', layer: 'L3', pose: POSE, data: { n: 1 } });
    expect(agree(s, 'sparse layers')).toEqual([b, a]);
  });

  it('a child on a higher layer than its container sorts after it', () => {
    const s = sceneWithLayers(3);
    const box = s.add({ kind: 'container', layer: 'L0', pose: POSE, data: { n: 0 } });
    const high = s.add({ kind: 'leaf', layer: 'L2', pose: POSE, data: { n: 1 }, parent: box });
    const low = s.add({ kind: 'leaf', layer: 'L0', pose: POSE, data: { n: 2 }, parent: box });
    const after = s.add({ kind: 'leaf', layer: 'L1', pose: POSE, data: { n: 3 } });
    expect(agree(s, 'child above parent')).toEqual([box, low, after, high]);
  });

  it('deep container nesting stays preorder within its layer', () => {
    const s = sceneWithLayers(2);
    const ids: NodeId[] = [];
    let parent: NodeId | null = null;
    for (let d = 0; d < 40; d++) {
      const id: NodeId = s.add({
        kind: 'container', layer: 'L0', pose: POSE, data: { n: d },
        ...(parent !== null ? { parent } : {}),
      });
      ids.push(id);
      parent = id;
    }
    expect(agree(s, 'deep chain')).toEqual(ids);
  });

  it('a dangling child id is skipped, and stops its subtree', () => {
    const s = sceneWithLayers(2);
    const box = s.add({ kind: 'container', layer: 'L0', pose: POSE, data: { n: 0 } });
    const inner = s.add({ kind: 'container', layer: 'L0', pose: POSE, data: { n: 1 }, parent: box });
    s.add({ kind: 'leaf', layer: 'L1', pose: POSE, data: { n: 2 }, parent: inner });
    const tail = s.add({ kind: 'leaf', layer: 'L0', pose: POSE, data: { n: 3 } });
    // `nodes` and `roots` are live views onto scene state; drop the record
    // without unlinking it so the traversal meets an id it cannot resolve.
    (s.nodes as Map<NodeId, unknown>).delete(inner);
    (s.roots as NodeId[]).push(asNodeId('ghost'));
    expect(agree(s, 'dangling child')).toEqual([box, tail]);
  });

  it('agrees across 200 generated scenes', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const layers = 1 + (seed % 8);
      const nodes = 1 + (seed * 7) % 120;
      const scene = randomScene(seed, layers, nodes);
      agree(scene, `seed ${seed} (${layers} layers, ${nodes} nodes)`);
      expect([...scene.renderOrder()], `seed ${seed} yields every node`)
        .toHaveLength(nodes);
    }
  });

  it('agrees after removals, reparenting, reordering and setLayer', () => {
    for (let seed = 500; seed < 540; seed++) {
      const rnd = mulberry32(seed);
      const scene = randomScene(seed, 1 + (seed % 5), 60);
      for (let step = 0; step < 25; step++) {
        const live = [...scene.renderOrder()];
        if (live.length === 0) break;
        const id = live[Math.floor(rnd() * live.length)];
        const roll = rnd();
        if (roll < 0.25) {
          scene.remove(id);
        } else if (roll < 0.5) {
          scene.move(id, null);
        } else if (roll < 0.75) {
          scene.reorder(id, Math.floor(rnd() * 4));
        } else {
          scene.undo();
        }
        agree(scene, `seed ${seed} step ${step}`);
      }
    }
  });

  it('agrees after a layer is added, reordered and removed', () => {
    const s = sceneWithLayers(2);
    s.add({ kind: 'leaf', layer: 'L0', pose: POSE, data: { n: 0 } });
    s.add({ kind: 'leaf', layer: 'L1', pose: POSE, data: { n: 1 } });
    s.addLayer({ id: 'extra', name: 'Extra' });
    s.add({ kind: 'leaf', layer: 'extra', pose: POSE, data: { n: 2 } });
    agree(s, 'after addLayer');
    s.moveLayer('extra', 0);
    agree(s, 'after moveLayer');
    s.removeLayer('extra');
    agree(s, 'after removeLayer');
    s.undo();
    agree(s, 'after undo of removeLayer');
    expect(s.layers.map((l) => l.id)).toContain('extra');
  });
});
