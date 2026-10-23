import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { POSE, makeScene, type Data, type Layer } from './testing/makeScene';

describe('mutations are auto-undoable', () => {
  it('setPose / setLayer / update round-trip through undo/redo', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
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

    s.setLayerLocked('structures', true);
    expect(s.layers[1].locked).toBe(true);
    s.undo();
    expect(s.layers[1].locked).toBe(false);
    s.redo();
    expect(s.layers[1].locked).toBe(true);
  });

  it('canUndo/canRedo reflect stack state', () => {
    const s = makeScene();
    expect(s.canUndo()).toBe(false);
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
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
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'c' } });
    s.undo(); s.undo(); s.undo();
    // Only the most recent two adds are undoable; the first one stays.
    expect(s.roots).toHaveLength(1);
  });
});

describe('batch', () => {
  it('groups mutations into one undo entry', () => {
    const s = makeScene();
    s.batch('build', () => {
      s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
      s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
      s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'c' } });
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
      s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
      s.batch('inner', () => {
        s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
      });
    });
    s.undo();
    expect(s.roots).toEqual([]);
  });
});

describe('untracked', () => {
  const at = (x: number) => ({ x, y: 0, width: 10, height: 10 });

  it('applies writes without recording an entry', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.untracked(() => { s.setPose(id, at(5)); });
    expect(s.get(id)?.pose).toEqual(at(5));
    expect(s.historyEntries()).toHaveLength(before);
  });

  it('notifies once and returns what fn returns', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    let count = 0;
    s.subscribe(() => { count++; });
    const out = s.untracked(() => { s.setPose(id, at(1)); s.setPose(id, at(2)); return 7; });
    expect(out).toBe(7);
    expect(count).toBe(1);
  });

  it('a batch inside it records nothing', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.untracked(() => s.batch('frame', () => { s.setPose(id, at(3)); }));
    expect(s.historyEntries()).toHaveLength(before);
  });

  it('inside a batch, its writes stay out of the entry and the batch still notifies once', () => {
    const s = makeScene();
    const a = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    let count = 0;
    s.subscribe(() => { count++; });
    s.batch('edit', () => {
      s.untracked(() => { s.setPose(a, at(9)); });
      s.setPose(b, at(4));
    });
    expect(count).toBe(1);
    s.undo();
    expect(s.get(b)?.pose).toEqual(POSE);
    expect(s.get(a)?.pose).toEqual(at(9));
  });

  it('undo past an untracked write does not restore it', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setPose(id, at(1));
    s.untracked(() => { s.setPose(id, at(2)); });
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual(at(1));
  });

  it('undoing the next recorded write lands on the untracked pose, even inside a coalesce window', () => {
    const s = createScene<Data, Layer>({
      systemLayers: [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }],
      coalesceWindowMs: 1e9,
    });
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setPose(id, at(1));
    s.untracked(() => { s.setPose(id, at(2)); });
    s.setPose(id, at(3));
    s.undo();
    expect(s.get(id)?.pose).toEqual(at(2));
  });

  it('reverts its writes if fn throws', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    expect(() => s.untracked(() => { s.setPose(id, at(6)); throw new Error('boom'); })).toThrow('boom');
    expect(s.get(id)?.pose).toEqual(POSE);
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
      kind: 'group',
      layer: 'structures',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: fn,
    });
    // Node is present with clipFromPose immediately after add.
    expect(scene.get(id)?.kind).toBe('group');
    expect((scene.get(id) as { clipFromPose?: unknown }).clipFromPose).toBe(fn);

    scene.undo();
    expect(scene.get(id)).toBeUndefined();

    scene.redo();
    const node = scene.get(id);
    expect(node?.kind).toBe('group');
    // clipFromPose must survive the undo/redo round-trip.
    expect((node as { clipFromPose?: unknown }).clipFromPose).toBe(fn);
  });
});
