import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { reconcileSpecs } from './reconcileSpecs';
import { asNodeId, type AddNodeSpec, type RectPose } from './types';

type D = { label?: string };
type Spec = AddNodeSpec<D, 'main', RectPose>;
const id = asNodeId;
const box = (k: string, x: number, extra: Partial<Spec> = {}): Spec => ({
  id: id(k), kind: 'mark', layer: 'main', pose: { x, y: 0, width: 10, height: 10 }, data: {}, ...extra,
});

describe('reconcileSpecs — a node locked on both sides', () => {
  it('takes the fields that changed and stays locked', () => {
    const prev = [box('a', 0, { locked: true })];
    const scene = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: prev });
    reconcileSpecs(scene, prev, [box('a', 5, { locked: true, data: { label: 'x' } })]);
    expect(scene.get(id('a'))!.pose.x).toBe(5);
    expect(scene.get(id('a'))!.data).toEqual({ label: 'x' });
    expect(scene.get(id('a'))!.locked).toBe(true);
  });

  it('takes the fields that changed on a node in a locked group', () => {
    const prev = [box('g', 0, { kind: 'group', locked: true }), box('a', 0, { parent: id('g') })];
    const scene = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: prev });
    reconcileSpecs(scene, prev, [box('g', 0, { kind: 'group', locked: true }), box('a', 5, { parent: id('g') })]);
    expect(scene.get(id('a'))!.pose.x).toBe(5);
  });

  it('adds a node to a locked layer', () => {
    const prev = [box('a', 0)];
    const scene = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main', locked: true }], initial: prev });
    reconcileSpecs(scene, prev, [box('a', 0), box('b', 3)]);
    expect(scene.get(id('b'))!.pose.x).toBe(3);
  });
});
