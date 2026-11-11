import { describe, expect, it } from 'vitest';
import { asNodeId, createScene, type SerializedScene } from '@weasel-js/core';
import { docFromSnapshot, nodeSpecsFromSnapshot, serializeReplacer } from './snapshot';

type Pose = { x: number; y: number; width: number; height: number };
const POSE = { x: 0, y: 0, width: 0, height: 0 };

describe('shrunk from the persistence and snapshot-read properties', () => {
  it('reads a document value shaped like the writer\'s wrapper back as itself', () => {
    const scene = createScene<Record<string, unknown>, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    scene.doc.set('app:theme', { __raw: [] });
    scene.doc.set('__proto__', { __ta: 'u8', data: [1] });
    const json = JSON.parse(JSON.stringify(scene.toJSON(), serializeReplacer)) as SerializedScene<unknown, 'main', Pose>;
    const doc = docFromSnapshot(json)!;
    expect(doc['app:theme']).toEqual({ __raw: [] });
    expect(Object.hasOwn(doc, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(doc, '__proto__')!.value).toEqual({ __ta: 'u8', data: [1] });
  });

  it('leaves a parsed snapshot as it was, so a second read of it reads the same', () => {
    const text = JSON.stringify({
      version: 3, systemLayers: [{ id: 'main' }],
      nodes: [{ id: 'n0', kind: 'mark', layer: 'main', pose: POSE, data: { v: { __raw: { __ta: 'u8', data: [1] } } } }],
    });
    const json = JSON.parse(text) as SerializedScene<Record<string, unknown>, 'main', Pose>;
    const first = nodeSpecsFromSnapshot(json)[0]!.data;
    const second = nodeSpecsFromSnapshot(json)[0]!.data;
    expect(JSON.stringify(json)).toBe(text);
    expect(first).toEqual({ v: { __ta: 'u8', data: [1] } });
    expect(second).toEqual(first);
    expect(nodeSpecsFromSnapshot(json)[0]!.id).toBe(asNodeId('n0'));
  });
});
