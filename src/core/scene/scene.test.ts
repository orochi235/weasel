import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';

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
    // No public getter for the registry; we'll test it indirectly via toJSON
    // in Task 2. For now, just confirm the option doesn't break construction.
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

  it('rejects cross-layer subtrees expressed via createScene({ initial })', () => {
    expect(() =>
      createScene<{ label: string }, 'structures' | 'plantings', typeof POSE>({
        systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
        initial: [
          { id: asNodeId('bed'), kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } },
          { id: asNodeId('plant'), kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'plant' }, parent: asNodeId('bed') },
        ],
      }),
    ).toThrow(/subtree layer must match parent/);
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

  it('rejects move() onto a parent on a different layer', () => {
    const s = makeScene();
    const bed1 = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed1' } });
    const bed2 = s.add({ kind: 'container', layer: 'plantings',  pose: POSE, data: { label: 'bed2' } });
    const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed1 });
    expect(() => s.move(plant, bed2)).toThrow(/subtree layer must match parent/);
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

  it('rejects a child added on a different layer than its parent', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    expect(() =>
      s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'plant' }, parent: bed }),
    ).toThrow(/subtree layer must match parent/);
  });

  it('accepts a child added on the same layer as its parent', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'plant' }, parent: bed });
    expect(s.childrenOf(bed)).toEqual([plant]);
  });
});

describe('setLayer — parent rejection and cascade', () => {
  it('setLayer rejects when the node has a parent on a different layer', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    expect(() => s.setLayer(plant, 'plantings')).toThrow(/subtree layer must match parent/);
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
