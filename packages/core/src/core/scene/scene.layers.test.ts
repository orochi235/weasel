import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { POSE, makeScene } from './testing/makeScene';

describe('setLayer — parent rejection and cascade', () => {
  it('setLayer onto a higher layer than the parent is allowed (renders above)', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    s.setLayer(plant, 'plantings');
    expect(s.get(plant)?.layer).toBe('plantings');
  });

  it('setLayer below the parent layer is rejected', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'plantings', pose: POSE, data: { label: 'bed' } });
    const child = s.add({ kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'p' }, parent: bed });
    expect(() => s.setLayer(child, 'structures')).toThrow(/may not render below its parent/);
  });

  it('setLayer succeeds on a leaf with no parent', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setLayer(id, 'plantings');
    expect(s.get(id)?.layer).toBe('plantings');
  });

  it('setLayer on a container cascades through all descendants', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const sub = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'sub' }, parent: bed });
    const leaf = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'leaf' }, parent: sub });
    s.setLayer(bed, 'plantings');
    expect(s.get(bed)?.layer).toBe('plantings');
    expect(s.get(sub)?.layer).toBe('plantings');
    expect(s.get(leaf)?.layer).toBe('plantings');
  });

  it('setLayer cascade is one undo step', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const leaf = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'leaf' }, parent: bed });
    s.setLayer(bed, 'plantings');
    s.undo();
    expect(s.get(bed)?.layer).toBe('structures');
    expect(s.get(leaf)?.layer).toBe('structures');
  });

  it('setLayer with current layer is a no-op (no history entry added)', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
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

describe('renderOrder with hidden layers', () => {
  it('does not filter hidden layers — visibility is a render-time concern', () => {
    // The Scene's renderOrder yields nodes regardless of layer visibility;
    // the Canvas integration is responsible for skipping hidden layers.
    const s = makeScene();
    const a = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setLayerVisible('structures', false);
    const order = [...s.renderOrder()];
    expect(order).toEqual([a]);
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
    const parent = scene.add({ kind: 'group', layer: 'base', pose: { x: 0 }, data: { v: 1 } });
    scene.add({ kind: 'mark', layer: 'fx', pose: { x: 1 }, data: { v: 2 }, parent });
    expect(() => scene.moveLayer('fx', 0)).toThrow(/below its parent/);
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
  });

  it('removeLayer drops the record and cascade-deletes tagged nodes', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.add({ kind: 'mark', layer: 'base', pose: { x: 0 }, data: { v: 1 } });
    const onFx = scene.add({ kind: 'mark', layer: 'fx', pose: { x: 1 }, data: { v: 2 } });
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
    const c = scene.add({ kind: 'group', layer: 'fx', pose: { x: 0 }, data: { v: 1 } });
    const child = scene.add({ kind: 'mark', layer: 'fx', pose: { x: 1 }, data: { v: 2 }, parent: c });
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
    const a = scene.add({ kind: 'mark', layer: 'fx', pose: { x: 0 }, data: { v: 1 } });
    const b = scene.add({ kind: 'mark', layer: 'fx', pose: { x: 1 }, data: { v: 2 } });
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
    const node = scene.add({ kind: 'mark', layer: 'top', pose: { x: 0 }, data: { v: 1 } });
    scene.removeLayer('mid'); // layers -> [base, top]; 'top' shifts index 2 -> 1
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'top']);
    // requireLayerIndex must resolve 'top' to its new slot for later mutations.
    scene.setLayerVisible('top', false);
    expect(scene.layers.find((l) => l.id === 'top')!.visible).toBe(false);
    expect(scene.get(node)!.layer).toBe('top');
  });
});
