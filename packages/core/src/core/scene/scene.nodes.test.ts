import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { POSE, makeScene, type Data, type Layer } from './testing/makeScene';

describe('add / remove / move', () => {
  it('add returns an id and inserts the node at the end of its parent', () => {
    const s = makeScene();
    const a = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    expect(s.roots).toEqual([a, b]);
    expect(s.get(a)?.data.label).toBe('a');
  });

  it('respects explicit id; throws on collision', () => {
    const s = makeScene();
    const id = asNodeId('explicit-1');
    s.add({ id, kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    expect(s.get(id)).toBeDefined();
    expect(() =>
      s.add({ id, kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'dup' } }),
    ).toThrow(/collision/);
  });

  it('uses generateId when no explicit id is supplied', () => {
    let n = 0;
    const s = createScene<Data, Layer>({
      systemLayers: [{ id: 'background' }, { id: 'structures' }, { id: 'plantings' }],
      generateId: () => asNodeId(`g${n++}`),
    });
    const a = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    expect(a).toBe('g0');
    expect(b).toBe('g1');
  });

  it('accepts a mark as a parent', () => {
    const s = makeScene();
    const mark = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const child = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' }, parent: mark });
    expect(s.childrenOf(mark)).toEqual([child]);
  });

  it('parents children under containers and tracks them in render order', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const tomato = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'tomato' }, parent: bed });
    expect(s.childrenOf(bed)).toEqual([tomato]);
    expect(s.ancestorsOf(tomato)).toEqual([bed]);
    // Render order: structures pass yields bed then tomato.
    const order = [...s.renderOrder()];
    expect(order).toEqual([bed, tomato]);
  });

  it('remove deletes the subtree and is undoable', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const t1 = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 't1' }, parent: bed });
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 't2' }, parent: bed });
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
    const a = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const inner = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'inner' }, parent: a });
    const child = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'c' }, parent: a });
    s.move(child, b);
    expect(s.childrenOf(a)).toEqual([inner]);
    expect(s.childrenOf(b)).toEqual([child]);
    expect(() => s.move(a, a)).toThrow(/itself/);
    expect(() => s.move(a, inner)).toThrow(/own descendant/);
  });

  it('rejects move() onto a parent on a HIGHER layer (child would render below parent)', () => {
    const s = makeScene();
    const bed1 = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed1' } });
    const bed2 = s.add({ kind: 'group', layer: 'plantings',  pose: POSE, data: { label: 'bed2' } });
    const plant = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed1 });
    // plant is on 'structures' (below 'plantings'); reparenting under bed2 would
    // make it render beneath its parent → rejected.
    expect(() => s.move(plant, bed2)).toThrow(/may not render below its parent/);
  });

  it('allows move() onto a parent on a LOWER layer (child renders above parent)', () => {
    const s = makeScene();
    const bed1 = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed1' } });
    const bed2 = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed2' } });
    const plant = s.add({ kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'p' }, parent: bed1 });
    s.move(plant, bed2);
    expect(s.childrenOf(bed2)).toEqual([plant]);
  });

  it('allows move(id, null) regardless of layer', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    s.move(plant, null);
    expect(s.childrenOf(bed)).toEqual([]);
  });

  it('reorder shifts within current parent', () => {
    const s = makeScene();
    const a = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const c = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'c' } });
    s.reorder(c, 0);
    expect(s.roots).toEqual([c, a, b]);
  });

  it('accepts a child added on a higher layer than its parent', () => {
    const s = makeScene();
    const bed = s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = s.add({ kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'plant' }, parent: bed });
    expect(s.get(plant)?.layer).toBe('plantings');
    expect(s.childrenOf(bed)).toEqual([plant]);
  });
});

describe('incarnation', () => {
  const add = (scene: ReturnType<typeof makeScene>, id: string, layer: Layer = 'structures') =>
    scene.add({ id: asNodeId(id), kind: 'group', layer, pose: POSE, data: { label: id } });

  it('holds across every edit to a node that stays in the scene', () => {
    const scene = makeScene();
    const a = add(scene, 'a');
    const b = add(scene, 'b');
    const before = scene.incarnation(a);
    expect(before).toBeDefined();
    scene.setPose(a, { ...POSE, x: 5 });
    scene.update(a, { data: { label: 'renamed' } });
    scene.setLayer(a, 'plantings');
    scene.setLayer(b, 'plantings');
    scene.move(a, b);
    scene.reorder(a, 0);
    scene.undo();
    expect(scene.incarnation(a)).toBe(before);
    expect(scene.incarnation(b)).not.toBe(before);
  });

  it('changes when an id is removed and added again', () => {
    const scene = makeScene();
    const a = add(scene, 'a');
    const first = scene.incarnation(a);
    scene.remove(a);
    expect(scene.incarnation(a)).toBeUndefined();
    add(scene, 'a');
    expect(scene.incarnation(a)).not.toBe(first);
  });

  it('changes when undo or redo brings an id back', () => {
    const scene = makeScene();
    const a = add(scene, 'a');
    const first = scene.incarnation(a);
    scene.remove(a);
    scene.undo();
    const restored = scene.incarnation(a);
    expect(restored).not.toBe(first);
    scene.undo();
    scene.redo();
    expect(scene.incarnation(a)).not.toBe(restored);
  });

  it('is undefined for an id not in the scene', () => {
    expect(makeScene().incarnation(asNodeId('nope'))).toBeUndefined();
  });
});

describe('removeMany', () => {
  function makeScene() {
    const scene = createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
    });
    const leaf = { kind: 'mark', layer: 'structures', pose: POSE, data: { label: '' } } as const;
    return { scene, leaf };
  }

  it('removes several roots as one undoable step', () => {
    const { scene, leaf } = makeScene();
    const a = scene.add(leaf);
    const b = scene.add(leaf);
    const c = scene.add(leaf);

    scene.removeMany([a, c]);
    expect(scene.roots).toEqual([b]);

    scene.undo();
    expect(scene.roots).toEqual([a, b, c]);
  });

  it('absorbs an id another id in the list already takes', () => {
    const { scene, leaf } = makeScene();
    const box = scene.add({ ...leaf, kind: 'group' });
    const child = scene.add({ ...leaf, parent: box });

    expect(() => scene.removeMany([box, child])).not.toThrow();
    expect(scene.get(child)).toBeUndefined();
    scene.undo();
    expect(scene.childrenOf(box)).toEqual([child]);
  });

  it('absorbs a duplicated id', () => {
    const { scene, leaf } = makeScene();
    const a = scene.add(leaf);
    expect(() => scene.removeMany([a, a])).not.toThrow();
    expect(scene.roots).toEqual([]);
  });

  it('throws on an id that is not in the scene', () => {
    const { scene, leaf } = makeScene();
    const a = scene.add(leaf);
    expect(() => scene.removeMany([a, asNodeId('ghost')])).toThrow(/unknown node id/);
  });

  it('takes the enclosing batch\'s label, not its own', () => {
    const { scene, leaf } = makeScene();
    scene.add({ ...leaf, kind: 'group' });
    scene.add(leaf);
    scene.batch('New document', () => {
      scene.removeMany([...scene.renderOrder()]);
    });
    expect(scene.roots).toEqual([]);
    expect(scene.historyEntries().at(-1)!.label).toBe('New document');
  });

  it('labels its own entry "remove" when there is no enclosing batch', () => {
    const { scene, leaf } = makeScene();
    scene.add(leaf);
    scene.removeMany([...scene.renderOrder()]);
    expect(scene.historyEntries().at(-1)!.label).toBe('remove');
  });

  it('records no history step for an empty list', () => {
    const { scene, leaf } = makeScene();
    const a = scene.add(leaf);
    scene.removeMany([]);
    // One undo has to reach the add. If the empty list recorded a step of its
    // own, this undo is spent on it and `a` is still here.
    scene.undo();
    expect(scene.get(a)).toBeUndefined();
  });

  it('leaves the scene untouched when an id is unknown', () => {
    const { scene, leaf } = makeScene();
    const a = scene.add(leaf);
    expect(() => scene.removeMany([a, asNodeId('ghost')])).toThrow();
    expect(scene.get(a)).toBeDefined();
  });
});
