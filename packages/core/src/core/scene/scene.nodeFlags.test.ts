/**
 * A node's own `hidden` and `locked`: undoable, inherited by its subtree,
 * kept out of the selection, and carried through a snapshot.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';

type Layer = 'base' | 'top';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };
const MOVED = { x: 5, y: 5, width: 10, height: 10 };

function tree() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }, { id: 'top' }] });
  const box = scene.add({ kind: 'container', id: asNodeId('box'), layer: 'base', pose: POSE, data: { label: 'box' } });
  const kid = scene.add({ kind: 'leaf', id: asNodeId('kid'), layer: 'top', pose: POSE, data: { label: 'kid' }, parent: box });
  const free = scene.add({ kind: 'leaf', id: asNodeId('free'), layer: 'base', pose: POSE, data: { label: 'free' } });
  return { scene, box, kid, free };
}

describe('Scene — setHidden', () => {
  it('hides a container with its subtree, as one undo step', () => {
    const { scene, box, kid, free } = tree();
    scene.setHidden(box, true);
    expect(scene.get(box)!.hidden).toBe(true);
    expect(scene.isHidden(kid)).toBe(true);
    expect(scene.isHidden(free)).toBe(false);
    scene.undo();
    expect(scene.get(box)!.hidden).toBeUndefined();
    expect(scene.isHidden(kid)).toBe(false);
    scene.redo();
    expect(scene.isHidden(kid)).toBe(true);
  });

  it('records nothing when the flag already holds', () => {
    const { scene, free } = tree();
    const depth = scene.historyIndex();
    scene.setHidden(free, false);
    expect(scene.historyIndex()).toBe(depth);
  });

  it('drops the hidden subtree from the selection, and undo puts it back', () => {
    const { scene, box, kid, free } = tree();
    scene.setSelection([kid, free]);
    scene.setHidden(box, true);
    expect(scene.getSelection()).toEqual([free]);
    scene.setSelection([kid, free]);
    expect(scene.getSelection()).toEqual([free]);
    scene.undo();
    expect(scene.getSelection()).toEqual([kid, free]);
  });

  it('hiding a layer drops its nodes from the selection too', () => {
    const { scene, kid, free } = tree();
    scene.setSelection([kid, free]);
    scene.setLayerVisible('top', false);
    expect(scene.getSelection()).toEqual([free]);
    expect(scene.isHidden(kid)).toBe(true);
  });

  it('leaves the node editable', () => {
    const { scene, free } = tree();
    scene.setHidden(free, true);
    scene.setPose(free, MOVED);
    expect(scene.get(free)!.pose).toEqual(MOVED);
  });
});

describe('Scene — setLocked', () => {
  it('locks a container with its subtree, refuses edits, and undoes', () => {
    const { scene, box, kid } = tree();
    scene.setLocked(box, true);
    expect(scene.isLocked(kid)).toBe(true);
    expect(() => scene.setPose(kid, MOVED)).toThrow(/locked/);
    expect(() => scene.update(box, { data: { label: 'x' } })).toThrow(/locked/);
    scene.undo();
    expect(scene.isLocked(kid)).toBe(false);
    scene.setPose(kid, MOVED);
  });

  it('is never blocked by a lock, its own or a layer’s', () => {
    const { scene, box, kid } = tree();
    scene.setLocked(box, true);
    scene.setLocked(kid, true);
    scene.setHidden(kid, true);
    scene.setLayerLocked('base', true);
    scene.setLocked(box, false);
    expect(scene.get(box)!.locked).toBeUndefined();
    expect(scene.isLocked(box)).toBe(true);
  });

  it('keeps a locked node out of the selection', () => {
    const { scene, free } = tree();
    scene.setSelection([free]);
    scene.setLocked(free, true);
    expect(scene.getSelection()).toEqual([]);
    scene.setSelection([free]);
    expect(scene.getSelection()).toEqual([]);
  });
});

describe('Scene — node flags in a snapshot', () => {
  it('round-trips through toJSON and loadState, and an unflagged node carries neither', () => {
    const { scene, box, kid } = tree();
    scene.setHidden(box, true);
    scene.setLocked(kid, true);
    const json = scene.toJSON();
    expect(json.nodes.find((n) => n.id === 'box')).toMatchObject({ hidden: true });
    expect(json.nodes.find((n) => n.id === 'kid')).toMatchObject({ locked: true });
    const free = json.nodes.find((n) => n.id === 'free')!;
    expect('hidden' in free || 'locked' in free).toBe(false);
    const copy = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }, { id: 'top' }] });
    copy.loadState(json);
    expect(copy.get(box)!.hidden).toBe(true);
    expect(copy.get(kid)!.locked).toBe(true);
  });

  it('add takes the flags from the spec, and a removal restores them', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'base' }] });
    const n = scene.add({ kind: 'leaf', layer: 'base', pose: POSE, data: { label: 'n' }, hidden: true });
    expect(scene.isHidden(n)).toBe(true);
    scene.remove(n);
    scene.undo();
    expect(scene.get(n)!.hidden).toBe(true);
  });
});
