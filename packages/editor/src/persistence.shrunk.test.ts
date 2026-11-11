import { describe, expect, it } from 'vitest';
import { createScene, type SerializedScene } from '@weasel-js/core';
import { docFromSnapshot, serializeReplacer } from './snapshot';

type Pose = { x: number; y: number; width: number; height: number };

describe('shrunk from the persistence property', () => {
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
});
