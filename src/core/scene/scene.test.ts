import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId } from './types';
import type { NodeId, SerializedScene, SystemLayerSpec } from './types';
import type { Op } from 'core/ops/types';
import { registerOpFactory } from 'core/ops/registry';

type Layer = 'background' | 'structures' | 'plantings';
interface Data { label: string }

const POSE = { x: 0, y: 0, width: 10, height: 10 };

function makeScene() {
  return createScene<Data, Layer>({
    systemLayers: [
      { id: 'background' },
      { id: 'structures' },
      { id: 'plantings' },
    ],
  });
}

describe('createScene — construction', () => {
  it('createScene accepts an optional registry option', () => {
    const scene = createScene<{ label: string }, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      registry: {
        clipFromPose: {
          'ellipse': (_pose) => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }),
        },
      },
    });
    // No public getter for the registry; it's tested indirectly via toJSON
    // elsewhere. Here, just confirm the option doesn't break construction.
    expect(scene).toBeDefined();
  });

  it('rejects empty systemLayers', () => {
    expect(() =>
      createScene<Data, 'a'>({ systemLayers: [] }),
    ).toThrow(/at least one layer/);
  });

  it('rejects duplicate system layer ids', () => {
    expect(() =>
      createScene<Data, 'a'>({ systemLayers: [{ id: 'a' }, { id: 'a' }] }),
    ).toThrow(/duplicate system layer/);
  });

  it('seeds layers as visible+unlocked by default, kind=system', () => {
    const s = makeScene();
    expect(s.layers).toHaveLength(3);
    for (const l of s.layers) {
      expect(l.kind).toBe('system');
      expect(l.visible).toBe(true);
      expect(l.locked).toBe(false);
    }
  });

  it('honors initial visible/locked overrides', () => {
    const s = createScene<Data, 'a' | 'b'>({
      systemLayers: [
        { id: 'a', visible: false },
        { id: 'b', locked: true },
      ],
    });
    expect(s.layers[0].visible).toBe(false);
    expect(s.layers[1].locked).toBe(true);
  });

  it('applies `initial` nodes without writing to history', () => {
    const s = createScene<Data, Layer>({
      systemLayers: [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }],
      initial: [
        { kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } },
      ],
    });
    expect(s.roots).toHaveLength(1);
    expect(s.canUndo()).toBe(false);
  });

  it('allows a child on a higher layer than its parent via createScene({ initial })', () => {
    const scene = createScene<{ label: string }, 'structures' | 'plantings', typeof POSE>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      initial: [
        { id: asNodeId('bed'), kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } },
        { id: asNodeId('plant'), kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'plant' }, parent: asNodeId('bed') },
      ],
    });
    expect(scene.get(asNodeId('plant'))?.layer).toBe('plantings');
    expect(scene.childrenOf(asNodeId('bed'))).toEqual([asNodeId('plant')]);
  });

  it('createScene({ initial }) preserves clipFromPose on container nodes', () => {
    const scene = createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      initial: [
        {
          id: asNodeId('bed'),
          kind: 'container',
          layer: 'structures',
          pose: POSE,
          data: { label: 'bed' },
          clipFromPose: () => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }),
        },
      ],
    });
    const node = scene.get(asNodeId('bed'));
    expect(node?.kind).toBe('container');
    expect(typeof (node as { clipFromPose?: unknown }).clipFromPose).toBe('function');
  });
});

describe('add / remove / move', () => {
  it('add returns an id and inserts the node at the end of its parent', () => {
    const s = makeScene();
    const a = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    expect(s.roots).toEqual([a, b]);
    expect(s.get(a)?.data.label).toBe('a');
  });

  it('respects explicit id; throws on collision', () => {
    const s = makeScene();
    const id = asNodeId('explicit-1');
    s.add({ id, kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    expect(s.get(id)).toBeDefined();
    expect(() =>
      s.add({ id, kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'dup' } }),
    ).toThrow(/collision/);
  });

  it('uses generateId when no explicit id is supplied', () => {
    let n = 0;
    const s = createScene<Data, Layer>({
      systemLayers: [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }],
      generateId: () => asNodeId(`g${n++}`),
    });
    const a = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    expect(a).toBe('g0');
    expect(b).toBe('g1');
  });

  it('rejects parent that is not a container', () => {
    const s = makeScene();
    const leaf = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    expect(() =>
      s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' }, parent: leaf }),
    ).toThrow(/not a container/);
  });

  it('parents children under containers and tracks them in render order', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const tomato = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'tomato' }, parent: bed });
    expect(s.childrenOf(bed)).toEqual([tomato]);
    expect(s.ancestorsOf(tomato)).toEqual([bed]);
    // Render order: structures pass yields bed then tomato.
    const order = [...s.renderOrder()];
    expect(order).toEqual([bed, tomato]);
  });

  it('remove deletes the subtree and is undoable', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const t1 = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 't1' }, parent: bed });
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 't2' }, parent: bed });
    s.remove(bed);
    expect(s.get(bed)).toBeUndefined();
    expect(s.get(t1)).toBeUndefined();
    expect(s.roots).toEqual([]);
    s.undo();
    expect(s.get(bed)?.data.label).toBe('bed');
    expect(s.childrenOf(bed)).toHaveLength(2);
    expect(s.roots).toEqual([bed]);
  });

  it('move reparents and reindexes; cycle is rejected', () => {
    const s = makeScene();
    const a = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const child = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'c' }, parent: a });
    s.move(child, b);
    expect(s.childrenOf(a)).toEqual([]);
    expect(s.childrenOf(b)).toEqual([child]);
    expect(() => s.move(a, a)).toThrow(/itself/);
    // Move b under itself transitively (via child) — still itself, but test descendant case:
    expect(() => s.move(b, child)).toThrow(/not a container/);
  });

  it('rejects move() onto a parent on a HIGHER layer (child would render below parent)', () => {
    const s = makeScene();
    const bed1 = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed1' } });
    const bed2 = s.add({ kind: 'container', layer: 'plantings',  pose: POSE, data: { label: 'bed2' } });
    const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed1 });
    // plant is on 'structures' (below 'plantings'); reparenting under bed2 would
    // make it render beneath its parent → rejected.
    expect(() => s.move(plant, bed2)).toThrow(/may not render below its parent/);
  });

  it('allows move() onto a parent on a LOWER layer (child renders above parent)', () => {
    const s = makeScene();
    const bed1 = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed1' } });
    const bed2 = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed2' } });
    const plant = s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'p' }, parent: bed1 });
    s.move(plant, bed2);
    expect(s.childrenOf(bed2)).toEqual([plant]);
  });

  it('allows move(id, null) regardless of layer', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    s.move(plant, null);
    expect(s.childrenOf(bed)).toEqual([]);
  });

  it('reorder shifts within current parent', () => {
    const s = makeScene();
    const a = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const c = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'c' } });
    s.reorder(c, 0);
    expect(s.roots).toEqual([c, a, b]);
  });

  it('accepts a child added on a higher layer than its parent', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'plant' }, parent: bed });
    expect(s.get(plant)?.layer).toBe('plantings');
    expect(s.childrenOf(bed)).toEqual([plant]);
  });

  it('accepts a child added on the same layer as its parent', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'plant' }, parent: bed });
    expect(s.childrenOf(bed)).toEqual([plant]);
  });
});

describe('setLayer — parent rejection and cascade', () => {
  it('setLayer onto a higher layer than the parent is allowed (renders above)', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    s.setLayer(plant, 'plantings');
    expect(s.get(plant)?.layer).toBe('plantings');
  });

  it('setLayer below the parent layer is rejected', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'plantings', pose: POSE, data: { label: 'bed' } });
    const child = s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'p' }, parent: bed });
    expect(() => s.setLayer(child, 'structures')).toThrow(/may not render below its parent/);
  });

  it('setLayer succeeds on a leaf with no parent', () => {
    const s = makeScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setLayer(id, 'plantings');
    expect(s.get(id)?.layer).toBe('plantings');
  });

  it('setLayer on a container cascades through all descendants', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const sub = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'sub' }, parent: bed });
    const leaf = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'leaf' }, parent: sub });
    s.setLayer(bed, 'plantings');
    expect(s.get(bed)?.layer).toBe('plantings');
    expect(s.get(sub)?.layer).toBe('plantings');
    expect(s.get(leaf)?.layer).toBe('plantings');
  });

  it('setLayer cascade is one undo step', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const leaf = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'leaf' }, parent: bed });
    s.setLayer(bed, 'plantings');
    s.undo();
    expect(s.get(bed)?.layer).toBe('structures');
    expect(s.get(leaf)?.layer).toBe('structures');
  });

  it('setLayer with current layer is a no-op (no history entry added)', () => {
    const s = makeScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    // Record how many entries are in the stack before the no-op call.
    // We can detect a new entry by checking canUndo before/after (the stack
    // starts non-empty due to the add above, but a no-op must not push another).
    s.setLayer(id, 'structures'); // same layer — should be a no-op
    // One undo step should undo the original `add`, not a spurious setLayer.
    s.undo();
    expect(s.get(id)).toBeUndefined(); // node is gone — only the add was on the stack
    expect(s.canUndo()).toBe(false);   // nothing else was pushed
  });
});

describe('mutations are auto-undoable', () => {
  it('setPose / setLayer / update round-trip through undo/redo', () => {
    const s = makeScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setPose(id, { x: 10, y: 20, width: 30, height: 40 });
    s.setLayer(id, 'plantings');
    s.update(id, { data: { label: 'a-renamed' } });
    expect(s.get(id)?.pose).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(s.get(id)?.layer).toBe('plantings');
    expect(s.get(id)?.data.label).toBe('a-renamed');
    s.undo(); // undo update
    expect(s.get(id)?.data.label).toBe('a');
    s.undo(); // undo setLayer
    expect(s.get(id)?.layer).toBe('structures');
    s.undo(); // undo setPose
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('setLayerVisible / setLayerLocked round-trip', () => {
    const s = makeScene();
    s.setLayerVisible('structures', false);
    expect(s.layers[1].visible).toBe(false);
    s.undo();
    expect(s.layers[1].visible).toBe(true);
    s.redo();
    expect(s.layers[1].visible).toBe(false);
  });

  it('canUndo/canRedo reflect stack state', () => {
    const s = makeScene();
    expect(s.canUndo()).toBe(false);
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    expect(s.canUndo()).toBe(true);
    expect(s.canRedo()).toBe(false);
    s.undo();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(true);
  });

  it('historyLimit caps the undo stack', () => {
    const s = createScene<Data, Layer>({
      systemLayers: [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }],
      historyLimit: 2,
    });
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'c' } });
    s.undo(); s.undo(); s.undo();
    // Only the most recent two adds are undoable; the first one stays.
    expect(s.roots).toHaveLength(1);
  });
});

describe('batch', () => {
  it('groups mutations into one undo entry', () => {
    const s = makeScene();
    s.batch('build', () => {
      s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
      s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
      s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'c' } });
    });
    expect(s.roots).toHaveLength(3);
    s.undo();
    expect(s.roots).toEqual([]);
    s.redo();
    expect(s.roots).toHaveLength(3);
  });

  it('empty batch does not pollute the stack', () => {
    const s = makeScene();
    s.batch('noop', () => {});
    expect(s.canUndo()).toBe(false);
  });

  it('nested batches collapse into the outer batch', () => {
    const s = makeScene();
    s.batch('outer', () => {
      s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
      s.batch('inner', () => {
        s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
      });
    });
    s.undo();
    expect(s.roots).toEqual([]);
  });
});

describe('custom op seam', () => {
  it('registers, applies, and undoes consumer ops on the same stack', () => {
    let external = 'before';
    const s = makeScene();
    s.registerOp<{ from: string; to: string }>('app:rename', {
      apply: (p) => { external = p.to; },
      revert: (p) => { external = p.from; },
    });
    s.recordOp({ kind: 'app:rename', payload: { from: 'before', to: 'after' } });
    expect(external).toBe('after');
    s.undo();
    expect(external).toBe('before');
    s.redo();
    expect(external).toBe('after');
  });

  it('throws on unknown recordOp kind', () => {
    const s = makeScene();
    expect(() => s.recordOp({ kind: 'unknown', payload: {} })).toThrow(/no registered op/);
  });

  it('rejects consumer registration of kit:* prefix', () => {
    const s = makeScene();
    expect(() =>
      s.registerOp('kit:hijack', { apply: () => {}, revert: () => {} }),
    ).toThrow(/reserved/);
  });

  it('options.ops pre-registers ops at construction', () => {
    let v = 0;
    const s = createScene<Data, Layer>({
      systemLayers: [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }],
      ops: {
        'app:bump': {
          apply: () => { v++; },
          revert: () => { v--; },
        },
      },
    });
    s.recordOp({ kind: 'app:bump', payload: null });
    expect(v).toBe(1);
    s.undo();
    expect(v).toBe(0);
  });
});

describe('subscribe / getVersion', () => {
  it('notifies listeners on mutation and bumps version', () => {
    const s = makeScene();
    let count = 0;
    const v0 = s.getVersion();
    const off = s.subscribe(() => { count++; });
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    expect(count).toBe(1);
    expect(s.getVersion()).toBeGreaterThan(v0);
    off();
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    expect(count).toBe(1);
  });

  it('undo and redo also bump version', () => {
    const s = makeScene();
    s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const v = s.getVersion();
    s.undo();
    expect(s.getVersion()).toBeGreaterThan(v);
    const v2 = s.getVersion();
    s.redo();
    expect(s.getVersion()).toBeGreaterThan(v2);
  });
});

describe('renderOrder with hidden layers', () => {
  it('does not filter hidden layers — visibility is a render-time concern', () => {
    // The Scene's renderOrder yields nodes regardless of layer visibility;
    // the Canvas integration is responsible for skipping hidden layers.
    const s = makeScene();
    const a = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setLayerVisible('structures', false);
    const order = [...s.renderOrder()];
    expect(order).toEqual([a]);
  });
});

// ─── C3: redo restores clipFromPose ──────────────────────────────────────────

describe('undo/redo of container add preserves clipFromPose', () => {
  it('undo+redo of a container add preserves clipFromPose', () => {
    const scene = createScene<Data, 'structures'>({
      systemLayers: [{ id: 'structures' }],
    });
    const fn = (pose: typeof POSE) => ({
      kind: 'rect' as const,
      x: pose.x,
      y: pose.y,
      width: pose.width,
      height: pose.height,
    });
    const id = scene.add({
      kind: 'container',
      layer: 'structures',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: fn,
    });
    // Node is present with clipFromPose immediately after add.
    expect(scene.get(id)?.kind).toBe('container');
    expect((scene.get(id) as { clipFromPose?: unknown }).clipFromPose).toBe(fn);

    scene.undo();
    expect(scene.get(id)).toBeUndefined();

    scene.redo();
    const node = scene.get(id);
    expect(node?.kind).toBe('container');
    // clipFromPose must survive the undo/redo round-trip.
    expect((node as { clipFromPose?: unknown }).clipFromPose).toBe(fn);
  });

  it('clipFromPose is callable and returns the correct clip after redo', () => {
    const scene = createScene<Data, 'structures'>({
      systemLayers: [{ id: 'structures' }],
    });
    const fn = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 5, y: 5, width: 20, height: 20 });
    const id = scene.add({
      kind: 'container',
      layer: 'structures',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: fn,
    });
    scene.undo();
    scene.redo();
    const node = scene.get(id);
    const cfp = (node as { clipFromPose?: (p: typeof POSE) => unknown }).clipFromPose;
    expect(cfp?.(POSE)).toEqual({ kind: 'rect', x: 5, y: 5, width: 20, height: 20 });
  });
});

// ─── pendingClipPatches leak-prune ───────────────────────────────────────────

/** Helper to access the test-only cache-size hook. */
function cacheSize(scene: unknown): number {
  return (scene as { __clipCacheSize: () => number }).__clipCacheSize();
}

describe('pendingClipPatches pruning', () => {
  it('prunes cache entry when redoStack is cleared by a new op', () => {
    const scene = createScene<Data, 'structures'>({
      systemLayers: [{ id: 'structures' }],
    });
    const fn = () => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const id = scene.add({
      kind: 'container',
      layer: 'structures',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: fn,
    });
    // Cache has one entry for the container.
    expect(cacheSize(scene)).toBe(1);

    // Undo removes the node from state.nodes; entry stays in cache for redo.
    scene.undo();
    expect(scene.get(id)).toBeUndefined();
    expect(cacheSize(scene)).toBe(1);

    // A new op branches the timeline: redoStack is cleared. The container is
    // absent from state.nodes, so the cache entry must be pruned.
    scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'other' } });
    expect(cacheSize(scene)).toBe(0);
  });

  it('does NOT prune cache entry when node is still in state.nodes at redo-stack clear', () => {
    // If a container is added and then another op runs (clearing the redo stack
    // which was already empty), the container is still live — entry must survive.
    const scene = createScene<Data, 'structures'>({
      systemLayers: [{ id: 'structures' }],
    });
    const fn = () => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    scene.add({
      kind: 'container',
      layer: 'structures',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: fn,
    });
    expect(cacheSize(scene)).toBe(1);
    // Another op without undo — redo stack was already empty, nothing to prune.
    scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'other' } });
    // Node is still in state.nodes → entry must not be pruned.
    expect(cacheSize(scene)).toBe(1);
  });

  it('prunes cache entry when undo-stack overflow evicts a kit:add for a removed node', () => {
    const scene = createScene<Data, 'structures'>({
      systemLayers: [{ id: 'structures' }],
      historyLimit: 2,
    });
    const fn = () => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    // Add a clipped container, then immediately remove it (so it leaves state.nodes).
    const id = scene.add({
      kind: 'container',
      layer: 'structures',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: fn,
    });
    scene.remove(id);
    // Undo stack: [kit:add(id), kit:remove(id)]. Cache still has the entry.
    expect(cacheSize(scene)).toBe(1);

    // Two more ops push the kit:add entry off the undo stack (limit=2).
    scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'y' } });
    // kit:add(id) is now evicted. Node is absent from state.nodes → pruned.
    expect(cacheSize(scene)).toBe(0);
  });

  it('prunes cache entry via batch when redoStack is cleared', () => {
    const scene = createScene<Data, 'structures'>({
      systemLayers: [{ id: 'structures' }],
    });
    const fn = () => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const id = scene.add({
      kind: 'container',
      layer: 'structures',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: fn,
    });
    scene.undo();
    expect(cacheSize(scene)).toBe(1);

    // Branch via a batch (triggers the batch-path redo-clear code).
    scene.batch('add-more', () => {
      scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    });
    expect(scene.get(id)).toBeUndefined();
    expect(cacheSize(scene)).toBe(0);
  });
});

describe('scene.toJSON', () => {
  it('captures a flat scene with no parents', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const a = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const json = scene.toJSON();
    expect(json.version).toBe(1);
    expect(json.systemLayers.map((l) => l.id)).toEqual(['structures', 'plantings']);
    expect(json.nodes).toHaveLength(2);
    expect(json.nodes[0]).toMatchObject({ id: a, kind: 'leaf', layer: 'structures', pose: POSE });
    expect(json.nodes[1]).toMatchObject({ id: b, kind: 'leaf', layer: 'structures', pose: POSE });
    expect(json.nodes[0].parent).toBeUndefined();
  });

  it('captures parent ids for nested subtrees', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const bed = scene.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    const json = scene.toJSON();
    const plantNode = json.nodes.find((n) => n.id === plant)!;
    expect(plantNode.parent).toBe(bed);
  });

  it('captures layer visible=false and locked=true; omits defaults', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    scene.setLayerVisible('structures', false);
    scene.setLayerLocked('plantings', true);
    const json = scene.toJSON();
    const s = json.systemLayers.find((l) => l.id === 'structures')!;
    const p = json.systemLayers.find((l) => l.id === 'plantings')!;
    expect(s.visible).toBe(false);
    expect(s.locked).toBeUndefined();
    expect(p.visible).toBeUndefined();
    expect(p.locked).toBe(true);
  });

  it('preserves layer-major DFS preorder in nodes array', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const a = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'b' } });
    const c = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'c' } });
    const json = scene.toJSON();
    expect(json.nodes.map((n) => n.id)).toEqual([a, c, b]);
  });

  it('writes clipFromPoseKey when the factory is in the registry', () => {
    const factory = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const scene = createScene<Data, 'structures' | 'plantings', typeof POSE>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const bed = scene.add({
      kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: factory,
    });
    const json = scene.toJSON();
    const bedNode = json.nodes.find((n) => n.id === bed)!;
    expect(bedNode.clipFromPoseKey).toBe('ellipse');
  });

  it('throws when a container has clipFromPose but no matching registry key', () => {
    const scene = createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      registry: {},
    });
    scene.add({
      kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: () => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }),
    });
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });

  it('omits clipFromPoseKey for containers without clipFromPose', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const bed = scene.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const json = scene.toJSON();
    const bedNode = json.nodes.find((n) => n.id === bed)!;
    expect(bedNode.clipFromPoseKey).toBeUndefined();
  });
});

describe('sceneFromJSON', () => {
  it('reconstructs a flat scene from JSON', () => {
    const original = makeScene();
    const a = original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    expect([...restored.roots]).toContain(asNodeId(a));
    expect(restored.get(asNodeId(a))?.data.label).toBe('a');
  });

  it('reconstructs parent/child relationships', () => {
    const original = makeScene();
    const bed = original.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    expect(restored.get(asNodeId(plant))?.parent).toBe(asNodeId(bed));
    expect([...restored.childrenOf(asNodeId(bed))]).toEqual([asNodeId(plant)]);
  });

  it('restores layer visibility and locked state', () => {
    const original = makeScene();
    original.setLayerVisible('structures', false);
    original.setLayerLocked('plantings', true);
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    const structures = restored.layers.find((l) => l.id === 'structures')!;
    const plantings = restored.layers.find((l) => l.id === 'plantings')!;
    expect(structures.visible).toBe(false);
    expect(plantings.locked).toBe(true);
  });

  it('resolves clipFromPoseKey via the registry', () => {
    const factory = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const original = createScene<Data, 'structures' | 'plantings', typeof POSE>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const bed = original.add({
      kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: factory,
    });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const restoredBed = restored.get(asNodeId(bed));
    expect(restoredBed?.kind).toBe('container');
    expect((restoredBed as { clipFromPose?: unknown }).clipFromPose).toBe(factory);
  });

  it('clipFromPose survives undo+redo after loading', () => {
    const factory = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const json: SerializedScene<Data, 'structures', typeof POSE> = {
      version: 1,
      systemLayers: [{ id: 'structures' }],
      nodes: [{
        id: 'bed',
        kind: 'container',
        layer: 'structures',
        pose: POSE,
        data: { label: 'bed' },
        clipFromPoseKey: 'ellipse',
      }],
    };
    const scene = sceneFromJSON(json, { registry: { clipFromPose: { 'ellipse': factory } } });
    const leaf = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'l' } });
    scene.undo();
    scene.redo();
    const bed = scene.get(asNodeId('bed'));
    expect((bed as { clipFromPose?: unknown }).clipFromPose).toBe(factory);
    void leaf;
  });

  it('throws on unknown version', () => {
    const json = { version: 2, systemLayers: [{ id: 'structures' as const }], nodes: [] };
    expect(() => sceneFromJSON(json as never, {})).toThrow(/unsupported version/);
  });

  it('throws on unknown clipFromPoseKey', () => {
    const json: SerializedScene<Data, 'structures', typeof POSE> = {
      version: 1,
      systemLayers: [{ id: 'structures' }],
      nodes: [{
        id: 'bed',
        kind: 'container',
        layer: 'structures',
        pose: POSE,
        data: { label: 'bed' },
        clipFromPoseKey: 'nonexistent',
      }],
    };
    expect(() => sceneFromJSON(json, { registry: {} })).toThrow(/unknown clipFromPose key 'nonexistent'/);
  });

  it('accepts a higher-layer child subtree in JSON (renders above its parent)', () => {
    const json: SerializedScene<Data, 'structures' | 'plantings', typeof POSE> = {
      version: 1,
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      nodes: [
        { id: 'bed', kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } },
        { id: 'plant', kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'p' }, parent: 'bed' },
      ],
    };
    const scene = sceneFromJSON(json, {});
    expect(scene.get('plant' as never)?.layer).toBe('plantings');
  });

  it('full round-trip: toJSON → sceneFromJSON → toJSON produces equivalent output', () => {
    const original = makeScene();
    const bed = original.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p1' }, parent: bed });
    original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p2' }, parent: bed });
    original.setLayerVisible('plantings', false);
    const json1 = original.toJSON();
    const restored = sceneFromJSON(json1, {});
    const json2 = restored.toJSON();
    expect(json2).toEqual(json1);
  });
});

describe('Scene.loadState', () => {
  type D = { kind: string; color: string };
  const LAYERS: SystemLayerSpec<'main'>[] = [{ id: 'main' }];

  function sceneWithTwoNodes() {
    const s = createScene<D, 'main'>({ systemLayers: LAYERS });
    s.add({ kind: 'leaf', layer: 'main', pose: { x: 1, y: 2, width: 3, height: 4 }, data: { kind: 'a', color: 'red' } });
    s.add({ kind: 'leaf', layer: 'main', pose: { x: 5, y: 6, width: 7, height: 8 }, data: { kind: 'b', color: 'blue' } });
    return s;
  }

  it('round-trips toJSON → loadState into an empty scene', () => {
    const src = sceneWithTwoNodes();
    const json = src.toJSON();
    const dst = createScene<D, 'main'>({ systemLayers: LAYERS });
    dst.loadState(json);
    expect(dst.toJSON()).toEqual(json);
    expect(dst.nodes.size).toBe(2);
  });

  it('preserves the instance, bumps version, and notifies once', () => {
    const dst = createScene<D, 'main'>({ systemLayers: LAYERS });
    const ref = dst;
    const listener = vi.fn();
    dst.subscribe(listener);
    const v0 = dst.getVersion();
    dst.loadState(sceneWithTwoNodes().toJSON());
    expect(dst).toBe(ref);
    expect(dst.getVersion()).toBeGreaterThan(v0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('replaces existing content (wipes prior nodes)', () => {
    const dst = sceneWithTwoNodes();
    const emptyJson = createScene<D, 'main'>({ systemLayers: LAYERS }).toJSON();
    dst.loadState(emptyJson);
    expect(dst.nodes.size).toBe(0);
    expect(dst.roots.length).toBe(0);
  });

  it('clears history (no undo/redo after load)', () => {
    const dst = sceneWithTwoNodes();
    expect(dst.canUndo()).toBe(true);
    dst.loadState(sceneWithTwoNodes().toJSON());
    expect(dst.canUndo()).toBe(false);
    expect(dst.canRedo()).toBe(false);
  });

  it('restores layer visibility/lock flags', () => {
    const src = createScene<D, 'main'>({ systemLayers: [{ id: 'main' }] });
    src.setLayerVisible('main', false);
    src.setLayerLocked('main', true);
    const dst = createScene<D, 'main'>({ systemLayers: [{ id: 'main' }] });
    dst.loadState(src.toJSON());
    expect(dst.layers[0].visible).toBe(false);
    expect(dst.layers[0].locked).toBe(true);
  });

  it('throws on an unsupported version', () => {
    const dst = createScene<D, 'main'>({ systemLayers: LAYERS });
    expect(() => dst.loadState({ version: 2, systemLayers: LAYERS, nodes: [] } as never)).toThrow(/version/);
  });

  it('restores a parented snapshot in place over a populated scene', () => {
    const src = createScene<D, 'main'>({ systemLayers: LAYERS });
    const bedId = src.add({ kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'bed', color: 'brown' } });
    src.add({ kind: 'leaf', layer: 'main', parent: bedId, pose: { x: 1, y: 1, width: 2, height: 2 }, data: { kind: 'plant', color: 'green' } });
    const json = src.toJSON();

    const dst = sceneWithTwoNodes(); // pre-populated with different, flat content
    dst.loadState(json);

    expect(dst.toJSON()).toEqual(json);
    expect([...dst.roots]).toEqual([bedId]);
    const bed = dst.get(bedId);
    expect(bed?.kind).toBe('container');
    const children = (bed as { children: readonly string[] }).children;
    expect(children.length).toBe(1);
    expect(dst.get(children[0] as NodeId)?.parent).toBe(bedId);
    expect([...dst.renderOrder()]).toEqual([bedId, children[0]]);
  });
});

describe('user-layer mutations', () => {
  const baseOpts = () => ({ systemLayers: [{ id: 'base' as const }] });

  it('addLayer appends a user layer to the top by default', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects' });
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
    const fx = scene.layers[1];
    expect(fx.kind).toBe('user');
    expect(fx.kind === 'user' && fx.name).toBe('Effects');
    expect(fx.visible).toBe(true);
    expect(fx.locked).toBe(false);
  });

  it('addLayer respects an explicit index', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects', index: 0 });
    expect(scene.layers.map((l) => l.id)).toEqual(['fx', 'base']);
  });

  it('addLayer throws on a duplicate id', () => {
    const scene = createScene<{ v: number }, 'base', { x: number }>(baseOpts());
    expect(() => scene.addLayer({ id: 'base', name: 'dupe' })).toThrow(/duplicate/);
  });

  it('addLayer is undoable', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.undo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base']);
    scene.redo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
  });

  it('renameLayer updates a user layer name and is undoable', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.renameLayer('fx', 'Glow');
    const fx = () => scene.layers.find((l) => l.id === 'fx')!;
    expect(fx().kind === 'user' && (fx() as { name: string }).name).toBe('Glow');
    scene.undo();
    expect(fx().kind === 'user' && (fx() as { name: string }).name).toBe('Effects');
  });

  it('renameLayer throws on a system layer', () => {
    const scene = createScene<{ v: number }, 'base', { x: number }>(baseOpts());
    expect(() => scene.renameLayer('base', 'nope')).toThrow(/system/);
  });

  it('renameLayer throws on an unknown layer', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    expect(() => scene.renameLayer('fx', 'nope')).toThrow(/unknown/);
  });

  it('moveLayer reorders and is undoable', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx' | 'top', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }, { id: 'top' }],
    });
    scene.moveLayer('top', 0);
    expect(scene.layers.map((l) => l.id)).toEqual(['top', 'base', 'fx']);
    scene.undo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx', 'top']);
  });

  it('moveLayer clamps an out-of-range index', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }],
    });
    scene.moveLayer('base', 99);
    expect(scene.layers.map((l) => l.id)).toEqual(['fx', 'base']);
  });

  it('moveLayer throws if the reorder would push a child below its parent', () => {
    // parent on 'base', child on 'fx' (higher). Moving 'fx' below 'base' is illegal.
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }],
    });
    const parent = scene.add({ kind: 'container', layer: 'base', pose: { x: 0 }, data: { v: 1 } });
    scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 }, parent });
    expect(() => scene.moveLayer('fx', 0)).toThrow(/below its parent/);
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
  });

  it('removeLayer drops the record and cascade-deletes tagged nodes', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.add({ kind: 'leaf', layer: 'base', pose: { x: 0 }, data: { v: 1 } });
    const onFx = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 } });
    scene.removeLayer('fx');
    expect(scene.layers.map((l) => l.id)).toEqual(['base']);
    expect(scene.get(onFx)).toBeUndefined();
    expect(scene.nodes.size).toBe(1);
  });

  it('removeLayer cascade-deletes a subtree that spans layers', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    scene.addLayer({ id: 'fx', name: 'Effects' });
    const c = scene.add({ kind: 'container', layer: 'fx', pose: { x: 0 }, data: { v: 1 } });
    const child = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 }, parent: c });
    scene.removeLayer('fx');
    expect(scene.get(c)).toBeUndefined();
    expect(scene.get(child)).toBeUndefined();
    expect(scene.nodes.size).toBe(0);
  });

  it('removeLayer is undoable — restores the layer and all its nodes in one step', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    scene.addLayer({ id: 'fx', name: 'Effects' });
    const a = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 0 }, data: { v: 1 } });
    const b = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 } });
    scene.removeLayer('fx');
    scene.undo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
    expect(scene.get(a)).toBeDefined();
    expect(scene.get(b)).toBeDefined();
  });

  it('removeLayer throws on a system layer', () => {
    const scene = createScene<{ v: number }, 'base', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    expect(() => scene.removeLayer('base')).toThrow(/system/);
  });

  it('removeLayer keeps layerIndex consistent for surviving layers', () => {
    // 'mid' and 'top' are user layers (added at runtime) so removeLayer is legal.
    const scene = createScene<{ v: number }, 'base' | 'mid' | 'top', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    scene.addLayer({ id: 'mid', name: 'Mid' }); // index 1
    scene.addLayer({ id: 'top', name: 'Top' }); // index 2
    const node = scene.add({ kind: 'leaf', layer: 'top', pose: { x: 0 }, data: { v: 1 } });
    scene.removeLayer('mid'); // layers -> [base, top]; 'top' shifts index 2 -> 1
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'top']);
    // requireLayerIndex must resolve 'top' to its new slot for later mutations.
    scene.setLayerVisible('top', false);
    expect(scene.layers.find((l) => l.id === 'top')!.visible).toBe(false);
    expect(scene.get(node)!.layer).toBe('top');
  });
});

describe('applyBatch (no journal)', () => {
  it('records one entry; undo replays inverted ops, redo replays forward ops', () => {
    const s = makeScene();
    const cell = { x: 0 };
    const mk = (from: number, to: number): Op => ({
      apply: () => { cell.x = to; },
      invert: () => mk(to, from),
    });
    s.applyBatch([mk(0, 5)], 'set x', null);
    expect(cell.x).toBe(5);
    expect(s.historyEntries()).toHaveLength(1);
    expect(s.undo()).toBe(true);
    expect(cell.x).toBe(0);
    s.redo();
    expect(cell.x).toBe(5);
  });

  it('ops are applied against the adapter passed at the call site', () => {
    const s = makeScene();
    const seen: unknown[] = [];
    const op: Op = {
      apply: (adapter) => { seen.push(adapter); },
      invert: () => op,
    };
    const adapter = { marker: true };
    s.applyBatch([op], 'probe', adapter);
    expect(seen).toEqual([adapter]);
  });

  it('ops that re-enter scene mutation methods do not double-record', () => {
    const s = makeScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const P2 = { x: 9, y: 9, width: 10, height: 10 };
    const mk = (from: typeof POSE, to: typeof POSE): Op => ({
      apply: (adapter) => { (adapter as typeof s).setPose(id, to); },
      invert: () => mk(to, from),
    });
    // The op mutates via the "adapter" (here: the scene itself, standing in
    // for a SceneCanvasAdapter that forwards to scene.setPose).
    s.applyBatch([mk(POSE, P2)], 'move', s);
    // Exactly two entries: the add and the applyBatch — the inner setPose
    // must not have recorded a third.
    expect(s.historyEntries()).toHaveLength(2);
    expect(s.get(id)?.pose).toEqual(P2);
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual(P2);
  });

  it('a throwing op mid-batch still flushes the deferred notify', () => {
    const s = makeScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    let notified = 0;
    s.subscribe(() => { notified++; });
    const P2 = { x: 9, y: 9, width: 10, height: 10 };
    const mutate: Op = {
      apply: (adapter) => { (adapter as typeof s).setPose(id, P2); },
      invert: () => mutate,
    };
    const boom: Op = {
      apply: () => { throw new Error('boom'); },
      invert: () => boom,
    };
    expect(() => s.applyBatch([mutate, boom], 'partial', s)).toThrow('boom');
    // The first op's mutation landed and subscribers must hear about it.
    expect(s.get(id)?.pose).toEqual(P2);
    expect(notified).toBe(1);
  });

  it('applyBatch nested in a batch does not swallow the outer batch dirt', () => {
    const s = makeScene();
    let notified = 0;
    s.subscribe(() => { notified++; });
    const cell = { x: 0 };
    const ext: Op = {
      apply: () => { cell.x = 1; },
      invert: () => ext,
    };
    s.batch('outer', () => {
      s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
      s.applyBatch([ext], 'inner', null);
    });
    expect(notified).toBe(1);
  });

  it('all-noop batches push no entry', () => {
    const s = makeScene();
    const op: Op = {
      apply: () => 'noop' as const,
      invert: () => op,
    };
    s.applyBatch([op], 'nothing', null);
    expect(s.canUndo()).toBe(false);
  });
});

describe('coalescing (coalesceWindowMs)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function timedScene() {
    return createScene<Data, Layer>({
      systemLayers: [
        { id: 'background' },
        { id: 'structures' },
        { id: 'plantings' },
      ],
      coalesceWindowMs: 500,
    });
  }

  it('rapid setPose on one node merges into a single entry', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length; // the add
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 3, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 1);
    expect(s.get(id)?.pose).toEqual({ x: 3, y: 0, width: 10, height: 10 });
  });

  it('undo of a coalesced entry returns to the pre-burst state; redo to the final', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 5, y: 0, width: 10, height: 10 });
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual({ x: 5, y: 0, width: 10, height: 10 });
  });

  it('a gap larger than the window starts a new entry', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(600); // outside the 500ms window
    s.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 2);
    s.undo();
    expect(s.get(id)?.pose).toEqual({ x: 1, y: 0, width: 10, height: 10 });
  });

  it('mutations on different nodes never merge', () => {
    const s = timedScene();
    const a = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const before = s.historyEntries().length;
    s.setPose(a, { x: 1, y: 0, width: 10, height: 10 });
    s.setPose(b, { x: 1, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 2);
  });

  it('scene.batch entries are always discrete (recordEntry never coalesces)', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.batch('drag', () => { s.setPose(id, { x: 1, y: 0, width: 10, height: 10 }); });
    vi.advanceTimersByTime(100);
    s.batch('drag', () => { s.setPose(id, { x: 2, y: 0, width: 10, height: 10 }); });
    expect(s.historyEntries().length).toBe(before + 2);
  });

  it('applyBatch entries coalesce on matching key multisets, order-independent', () => {
    const s = timedScene();
    const cell = { a: 0, b: 0 };
    const mk = (k: 'a' | 'b', from: number, to: number): Op => ({
      coalesceKey: `set:${k}`,
      apply: () => { cell[k] = to; },
      invert: () => mk(k, to, from),
    });
    s.applyBatch([mk('a', 0, 1), mk('b', 0, 1)], 'drag', null);
    vi.advanceTimersByTime(100);
    s.applyBatch([mk('b', 1, 2), mk('a', 1, 2)], 'drag', null); // reordered — multiset match
    expect(cell).toEqual({ a: 2, b: 2 });
    expect(s.historyEntries()).toHaveLength(1);
    s.undo();
    expect(cell).toEqual({ a: 0, b: 0 });
    s.redo();
    expect(cell).toEqual({ a: 2, b: 2 });
  });

  it('sceneFromJSON forwards coalesceWindowMs', () => {
    const src = createScene<Data, Layer>({
      systemLayers: [
        { id: 'background' },
        { id: 'structures' },
        { id: 'plantings' },
      ],
    });
    const restored = sceneFromJSON(src.toJSON(), { coalesceWindowMs: 500 });
    const id = restored.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = restored.historyEntries().length;
    restored.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    restored.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    expect(restored.historyEntries().length).toBe(before + 1);
  });
});

describe('history persistence (serializeHistory / restoreHistory)', () => {
  /** Serialize scene A's state+history, rebuild both into a fresh scene. */
  function roundTrip(a: ReturnType<typeof makeScene>) {
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    return b;
  }

  it('native-op entries undo/redo after a round-trip', () => {
    const a = makeScene();
    const id = a.add({ id: asNodeId('n1'), kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    a.setPose(id, { x: 5, y: 5, width: 10, height: 10 });
    const b = roundTrip(a);
    expect(b.historyEntries()).toHaveLength(2);
    expect(b.undo()).toBe(true);
    expect(b.get(asNodeId('n1'))?.pose).toEqual(POSE);
    b.undo();
    expect(b.get(asNodeId('n1'))).toBeUndefined();
    b.redo(); b.redo();
    expect(b.get(asNodeId('n1'))?.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });

  it('consumer registerOp kinds round-trip when re-registered before restore', () => {
    let ext = 'initial';
    const handler = {
      apply: (p: { from: string; to: string }) => { ext = p.to; },
      revert: (p: { from: string; to: string }) => { ext = p.from; },
    };
    const a = makeScene();
    a.registerOp('app:rename', handler);
    a.recordOp({ kind: 'app:rename', payload: { from: 'initial', to: 'renamed' } });
    const snap = a.serializeHistory();

    const b = makeScene();
    b.registerOp('app:rename', handler);
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    ext = 'renamed'; // state at snapshot head
    b.undo();
    expect(ext).toBe('initial');
    b.redo();
    expect(ext).toBe('renamed');
  });

  it('external-op entries replay through the lazy history adapter (wired after restore)', () => {
    const NAME = 'scenetest:cellSet';
    let cell = 0;
    const mk = (f: number, t: number): Op => ({
      name: NAME, args: { from: f, to: t },
      apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
      invert: () => mk(t, f),
    });
    registerOpFactory(NAME, (args) => {
      const { from, to } = args as { from: number; to: number };
      return mk(from, to);
    });
    const liveAdapter = { set: (v: number) => { cell = v; } };
    const a = makeScene();
    a.applyBatch([mk(0, 7)], 'set cell', liveAdapter);
    expect(cell).toBe(7);

    const b = roundTrip(a);
    // Adapter wired AFTER restore — lazy binding must not care.
    b.setHistoryAdapter(() => liveAdapter);
    b.undo();
    expect(cell).toBe(0);
    b.redo();
    expect(cell).toBe(7);
  });

  it('restored external ops with no history adapter are warning no-ops, never throws', () => {
    const NAME = 'scenetest:noAdapter';
    let cell = 0;
    registerOpFactory(NAME, (args) => {
      const { to } = args as { to: number };
      const mk = (t: number): Op => ({
        name: NAME, args: { to: t },
        apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
        invert: () => mk(0),
      });
      return mk(to);
    });
    const a = makeScene();
    a.applyBatch([{
      name: NAME, args: { to: 9 },
      apply: (adapter) => { (adapter as { set(v: number): void }).set(9); },
      invert: () => ({ name: NAME, args: { to: 0 }, apply: () => { cell = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set', { set: (v: number) => { cell = v; } });
    const b = roundTrip(a);
    expect(() => b.undo()).not.toThrow(); // no adapter wired: no-op with a debug warning
    expect(cell).toBe(9);
  });

  it('unknown op kinds restore as placeholders that keep their stack slot', () => {
    const a = makeScene();
    a.registerOp('app:oneoff', { apply: () => {}, revert: () => {} });
    a.recordOp({ kind: 'app:oneoff', payload: null });
    a.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();       // 'app:oneoff' NOT re-registered
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    expect(b.historyEntries()).toHaveLength(2); // slot preserved
    b.undo();                                    // undoes the add
    b.undo();                                    // placeholder — no throw, no effect
    expect(b.canUndo()).toBe(false);
  });

  it('restoreHistory replaces existing history and restored entries never coalesce', () => {
    const a = makeScene();
    a.add({ id: asNodeId('n1'), kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();
    b.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'pre' } });
    b.loadState(a.toJSON());     // clears history + state
    b.restoreHistory(snap);
    expect(b.historyEntries()).toHaveLength(1);
    b.setPose(asNodeId('n1'), { x: 1, y: 1, width: 10, height: 10 });
    expect(b.historyEntries()).toHaveLength(2); // no merge into the restored entry
  });

  it('restoreHistory notifies subscribers exactly once', () => {
    const a = makeScene();
    a.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    let n = 0;
    b.subscribe(() => { n++; });
    b.restoreHistory(snap);
    expect(n).toBe(1);
  });
});
