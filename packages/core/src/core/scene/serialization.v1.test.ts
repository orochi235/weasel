import { describe, expect, it } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { effectivePose } from './effectivePose';
import { UNION_OF_CHILDREN } from './kitRegistry';
import type { RectPose, SerializedScene, SerializedSceneV1 } from './types';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;
type V1 = SerializedSceneV1<object, 'main', RectPose>;

const box = (x: number, y: number, w = 10, h = 10): RectPose =>
  ({ x, y, width: w, height: h });

const v1 = (nodes: V1['nodes']): V1 =>
  ({ version: 1, systemLayers: [{ id: 'main' }], nodes });

const V1_NODES: V1['nodes'] = [
  { id: 'l', kind: 'leaf', layer: 'main', pose: box(0, 0), data: {} },
  { id: 'c', kind: 'container', layer: 'main', pose: box(20, 0), data: {} },
  { id: 'k', kind: 'leaf', parent: 'c', layer: 'main', pose: box(20, 0), data: {} },
];

describe('save format version 3', () => {
  it('writes version 3 with mark and group kinds', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const m = scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0), data: {} });
    const g = scene.add({ kind: 'group', layer: 'main', pose: box(0, 0), data: {} });
    const json = scene.toJSON();
    expect(json.version).toBe(3);
    expect(json.nodes.find((n) => n.id === m)!.kind).toBe('mark');
    expect(json.nodes.find((n) => n.id === g)!.kind).toBe('group');
  });

  it('throws on a version it does not know', () => {
    const json = { ...v1([]), version: 4 } as unknown as SerializedScene<object, 'main', RectPose>;
    expect(() => sceneFromJSON<object, 'main', RectPose>(json, {})).toThrow('unsupported version 4');
  });
});

describe('reading a version 1 save', () => {
  it('loads leaf as mark and container as group, with the child intact', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>(v1(V1_NODES), {});
    expect(scene.get('l' as never)!.kind).toBe('mark');
    expect(scene.get('c' as never)!.kind).toBe('group');
    expect(scene.get('k' as never)!.parent).toBe('c');
    expect(scene.childrenOf('c' as never)).toEqual(['k']);
  });

  it('lets classifyV1 turn a container into a mark that keeps its children', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>(v1(V1_NODES), { classifyV1: () => 'mark' });
    expect(scene.get('c' as never)!.kind).toBe('mark');
    expect(scene.childrenOf('c' as never)).toEqual(['k']);
  });

  it('loads an envelope as a group whose pose still derives from its children', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>(v1([
      { id: 'g', kind: 'container', layer: 'main', pose: box(0, 0, 0, 0), data: {},
        dependsOn: 'children', derivePoseKey: UNION_OF_CHILDREN },
      { id: 'a', kind: 'leaf', parent: 'g', layer: 'main', pose: box(0, 0), data: {} },
      { id: 'b', kind: 'leaf', parent: 'g', layer: 'main', pose: box(90, 40), data: {} },
    ]), {}) as S;
    expect(scene.get('g' as never)!.kind).toBe('group');
    expect(effectivePose(scene, scene.get('g' as never)!)).toEqual(box(0, 0, 100, 50));
  });
});

describe('reading a save whose poses are world', () => {
  const turned: RectPose = { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 };
  const v2 = (nodes: SerializedScene<object, 'main', RectPose>['nodes']) =>
    ({ version: 2 as const, systemLayers: [{ id: 'main' as const }], nodes });

  it('stores a version 2 child in its container\'s frame, where it drew before', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>(v2([
      { id: 'c', kind: 'group', layer: 'main', pose: box(100, 50, 200, 200), data: {} },
      { id: 'k', kind: 'mark', parent: 'c', layer: 'main', pose: box(130, 70), data: {} },
      { id: 'n', kind: 'mark', parent: 'k', layer: 'main', pose: box(135, 75), data: {} },
    ]), {});
    expect(scene.get('c' as never)!.pose).toEqual(box(100, 50, 200, 200));
    expect(scene.get('k' as never)!.pose).toEqual(box(30, 20));
    expect(scene.get('n' as never)!.pose).toEqual(box(5, 5));
  });

  it('undoes a turned container\'s frame too', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>(v2([
      { id: 'c', kind: 'group', layer: 'main', pose: turned, data: {} },
      { id: 'k', kind: 'mark', parent: 'c', layer: 'main', pose: { ...box(65, 15, 20, 10), rotation: Math.PI / 2 }, data: {} },
    ]), {});
    const k = scene.get('k' as never)!.pose;
    expect(k.x).toBeCloseTo(10);
    expect(k.y).toBeCloseTo(20);
    expect(k.rotation).toBeCloseTo(0);
  });

  it('leaves a child of an envelope in the frame above it', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>(v2([
      { id: 'f', kind: 'group', layer: 'main', pose: box(100, 100, 300, 300), data: {} },
      { id: 'g', kind: 'group', parent: 'f', layer: 'main', pose: box(0, 0, 0, 0), data: {},
        dependsOn: 'children', derivePoseKey: UNION_OF_CHILDREN },
      { id: 'a', kind: 'mark', parent: 'g', layer: 'main', pose: box(110, 120), data: {} },
    ]), {});
    expect(scene.get('a' as never)!.pose).toEqual(box(10, 20));
  });

  it('reads a version 1 save the same way', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>(v1(V1_NODES), {});
    expect(scene.get('k' as never)!.pose).toEqual(box(0, 0));
  });

  it('keeps a version 3 child as stored', () => {
    const scene = sceneFromJSON<object, 'main', RectPose>({ ...v2([
      { id: 'c', kind: 'group', layer: 'main', pose: box(100, 50, 200, 200), data: {} },
      { id: 'k', kind: 'mark', parent: 'c', layer: 'main', pose: box(30, 20), data: {} },
    ]), version: 3 }, {});
    expect(scene.get('k' as never)!.pose).toEqual(box(30, 20));
  });
});
