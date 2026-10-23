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

describe('save format version 2', () => {
  it('writes version 2 with mark and group kinds', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const m = scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0), data: {} });
    const g = scene.add({ kind: 'group', layer: 'main', pose: box(0, 0), data: {} });
    const json = scene.toJSON();
    expect(json.version).toBe(2);
    expect(json.nodes.find((n) => n.id === m)!.kind).toBe('mark');
    expect(json.nodes.find((n) => n.id === g)!.kind).toBe('group');
  });

  it('throws on a version it does not know', () => {
    const json = { ...v1([]), version: 3 } as unknown as SerializedScene<object, 'main', RectPose>;
    expect(() => sceneFromJSON<object, 'main', RectPose>(json, {})).toThrow('unsupported version 3');
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
