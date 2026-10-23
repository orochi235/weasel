import { asNodeId, type SerializedScene, type SerializedSceneV1 } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { docFromSnapshot, nodeSpecsFromSnapshot, reviveTypedArrays, serializeReplacer } from './snapshot';

// Regression for the reload bug where a loader filtered `kind === 'mark'` and dropped `parent`,
// losing containers and nesting even though `toJSON()` persisted the full tree.
describe('snapshot — scene snapshot to node specs', () => {
  type Data = { kind?: string; fill?: string; coords?: unknown };
  type Layer = 'default';
  type Pose = { x: number; y: number; width: number; height: number };

  it('preserves containers and parent links so nesting survives reload', () => {
    const json: SerializedScene<Data, Layer, Pose> = {
      version: 2,
      systemLayers: [{ id: 'default' }],
      // Layer-major DFS-preorder, exactly as toJSON() emits: parent before child.
      nodes: [
        { id: 'g', kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { kind: 'group' } },
        { id: 'a', kind: 'mark', layer: 'default', pose: { x: 10, y: 10, width: 20, height: 20 }, data: { fill: '#fff' }, parent: 'g' },
        { id: 'b', kind: 'mark', layer: 'default', pose: { x: 50, y: 0, width: 20, height: 20 }, data: { fill: '#000' } },
      ],
    };

    const specs = nodeSpecsFromSnapshot(json);

    // All three nodes survive, in preorder.
    expect(specs.map((s) => s.id)).toEqual([asNodeId('g'), asNodeId('a'), asNodeId('b')]);
    // The container is restored as a container (not filtered out).
    expect(specs.find((s) => s.id === asNodeId('g'))!.kind).toBe('group');
    // The nested leaf keeps its parent link.
    expect(specs.find((s) => s.id === asNodeId('a'))!.parent).toBe(asNodeId('g'));
    // The root leaf has no parent.
    expect(specs.find((s) => s.id === asNodeId('b'))!.parent ?? null).toBeNull();
  });

  it('reads a version 1 snapshot, with its leaves as marks and its containers as groups', () => {
    const json: SerializedSceneV1<Data, Layer, Pose> = {
      version: 1,
      systemLayers: [{ id: 'default' }],
      nodes: [
        { id: 'g', kind: 'container', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} },
        { id: 'a', kind: 'leaf', layer: 'default', pose: { x: 10, y: 10, width: 20, height: 20 }, data: {}, parent: 'g' },
      ],
    };
    expect(nodeSpecsFromSnapshot(json).map((s) => s.kind)).toEqual(['group', 'mark']);
  });

  it('revives typed arrays inside node data', () => {
    const json: SerializedScene<Data, Layer, Pose> = {
      version: 2,
      systemLayers: [{ id: 'default' }],
      nodes: [
        { id: 'a', kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { coords: [1.5, 2.5, 3.5] } },
      ],
    };

    const specs = nodeSpecsFromSnapshot(json);
    const coords = (specs[0].data as { coords: unknown }).coords;
    expect(coords).toBeInstanceOf(Float32Array);
  });
  it('revives a typed array under any key, not only a path\'s', () => {
    const data = { weights: new Float32Array([0.25, 0.75]), nested: [{ ids: new Uint8Array([3, 4]) }] };
    const revived = reviveTypedArrays(JSON.parse(JSON.stringify(data, serializeReplacer)) as typeof data);
    expect(revived.weights).toBeInstanceOf(Float32Array);
    expect(revived).toEqual(data);
  });
  it('keeps an image node\'s data through the JSON hop', () => {
    const image = { src: 'data:image/png;base64,iVBORw0KGgo=', opacity: 0.5, source: { x: 0, y: 0, width: 0.5, height: 1 }, flipY: true };
    const json = JSON.parse(JSON.stringify({
      version: 2,
      systemLayers: [{ id: 'default' }],
      nodes: [{ id: 'im', kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { image } }],
    }, serializeReplacer)) as SerializedScene<{ image: typeof image }, Layer, Pose>;

    expect(nodeSpecsFromSnapshot(json)[0].data).toEqual({ image });
  });

  it('restores a container\'s layout by its key, and the pickable, hidden, and locked flags', () => {
    const layout = { snap: { pickTarget: () => null } } as never;
    const json: SerializedScene<Data, Layer, Pose> = {
      version: 2,
      systemLayers: [{ id: 'default' }],
      nodes: [
        { id: 'g', kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {}, layoutKey: 'stack', locked: true },
        { id: 'a', kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {}, parent: 'g', pickable: false, hidden: true },
      ],
    };
    const [g, a] = nodeSpecsFromSnapshot(json, { layout: { stack: layout } });
    expect(g!.layout).toBe(layout);
    expect(g!.locked).toBe(true);
    expect(a!.pickable).toBe(false);
    expect(a!.hidden).toBe(true);
  });
});

describe('docFromSnapshot', () => {
  const base = { version: 2 as const, systemLayers: [{ id: 'default' as const }], nodes: [] };

  it('reads the document values a snapshot carries', () => {
    expect(docFromSnapshot({ ...base, doc: { 'core:pages': { pages: [] } } })).toEqual({ 'core:pages': { pages: [] } });
  });

  it('answers undefined for a snapshot written before document values, or a malformed one', () => {
    expect(docFromSnapshot(base)).toBeUndefined();
    expect(docFromSnapshot({ ...base, doc: [1] as never })).toBeUndefined();
  });
});
