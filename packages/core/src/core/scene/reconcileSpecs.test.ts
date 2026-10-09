import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { reconcileSpecs } from './reconcileSpecs';
import { asNodeId, type AddNodeSpec, type RectPose } from './types';

type D = { label?: string };
type Spec = AddNodeSpec<D, 'main', RectPose>;
const id = asNodeId;
const box = (k: string, x: number, extra: Partial<Spec> = {}): Spec => ({
  id: id(k), kind: 'leaf', layer: 'main', pose: { x, y: 0, width: 10, height: 10 }, data: {}, ...extra,
});
const sceneOf = (specs: Spec[]) =>
  createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: specs });
const ids = (s: ReturnType<typeof sceneOf>) => [...s.renderOrder()];

describe('reconcileSpecs', () => {
  it('adds, removes and updates by id', () => {
    const prev = [box('a', 0), box('b', 0)];
    const scene = sceneOf(prev);
    reconcileSpecs(scene, prev, [box('a', 5, { data: { label: 'x' } }), box('c', 0)]);
    expect(ids(scene)).toEqual(['a', 'c']);
    expect(scene.get(id('a'))!.pose.x).toBe(5);
    expect(scene.get(id('a'))!.data).toEqual({ label: 'x' });
  });

  it('leaves a field the scene changed alone when the specs did not change it', () => {
    const prev = [box('a', 0), box('b', 0)];
    const scene = sceneOf(prev);
    scene.setPose(id('a'), { x: 99, y: 0, width: 10, height: 10 });
    reconcileSpecs(scene, prev, [box('a', 0), box('b', 7)]);
    expect(scene.get(id('a'))!.pose.x).toBe(99);
    expect(scene.get(id('b'))!.pose.x).toBe(7);
  });

  it('records no undo step', () => {
    const prev = [box('a', 0)];
    const scene = sceneOf(prev);
    reconcileSpecs(scene, prev, [box('a', 5), box('b', 0)]);
    expect(scene.canUndo()).toBe(false);
  });

  it('moves a container without moving its unchanged child', () => {
    const prev: Spec[] = [box('g', 0, { kind: 'container' }), box('t', 2, { parent: id('g') })];
    const scene = sceneOf(prev);
    reconcileSpecs(scene, prev, [box('g', 50, { kind: 'container' }), box('t', 2, { parent: id('g') })]);
    expect(scene.get(id('g'))!.pose.x).toBe(50);
    expect(scene.get(id('t'))!.pose.x).toBe(2);
  });

  it('re-adds a node whose kind changed, with what its removal took', () => {
    const prev: Spec[] = [box('a', 0), box('e', 0, { dependsOn: [id('a')] })];
    const scene = sceneOf(prev);
    reconcileSpecs(scene, prev, [box('a', 0, { kind: 'container' }), box('e', 0, { dependsOn: [id('a')] })]);
    expect(scene.get(id('a'))!.kind).toBe('container');
    expect(scene.get(id('e'))).toBeDefined();
  });

  it('re-adds a node the scene lost', () => {
    const prev = [box('a', 0)];
    const scene = sceneOf(prev);
    scene.remove(id('a'));
    reconcileSpecs(scene, prev, prev);
    expect(scene.get(id('a'))).toBeDefined();
  });

  it('throws on a spec with no id', () => {
    const scene = sceneOf([]);
    const { id: _, ...anon } = box('a', 0);
    expect(() => reconcileSpecs(scene, [], [anon as Spec])).toThrow(/needs an id/);
  });
});
