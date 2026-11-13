import { RECT_POSE_DESCRIPTOR, asNodeId, type PoseDescriptor, type RectPose, type SerializedScene, type SerializedSceneV1 } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import {
  adoptSnapshotPages, docFromSnapshot, nodeSpecsFromSnapshot, reviveTypedArrays, serializeReplacer, snapshotRebuildsTree,
} from './snapshot';

// Regression for the reload bug where a loader filtered `kind === 'mark'` and dropped `parent`,
// losing containers and nesting even though `toJSON()` persisted the full tree.
describe('snapshot — scene snapshot to node specs', () => {
  type Data = { kind?: string; fill?: string; coords?: unknown };
  type Layer = 'default';
  type Pose = { x: number; y: number; width: number; height: number };

  it('takes a reviver that migrates an older shape of data, typed as the scene data', () => {
    type Saved = { fill?: string; color?: string };
    const json: SerializedScene<Saved, Layer, Pose> = {
      version: 3,
      systemLayers: [{ id: 'default' }],
      nodes: [{ id: 'a', kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { color: '#f00' } }],
    };
    const migrate = ({ color, ...rest }: Saved): Saved => (color === undefined ? rest : { ...rest, fill: color });
    expect(nodeSpecsFromSnapshot(json, {}, migrate)[0]?.data).toEqual({ fill: '#f00' });
    expect(json.nodes[0]?.data).toEqual({ color: '#f00' });
  });

  it('preserves containers and parent links so nesting survives reload', () => {
    const json: SerializedScene<Data, Layer, Pose> = {
      version: 3,
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

  it('hands a version 1 container to the classifier it is given', () => {
    const json: SerializedSceneV1<Data, Layer, Pose> = {
      version: 1,
      systemLayers: [{ id: 'default' }],
      nodes: [
        { id: 'c', kind: 'container', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} },
        { id: 'l', kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} },
      ],
    };
    const seen: string[] = [];
    const specs = nodeSpecsFromSnapshot(json, {}, undefined, { classifyV1: (n) => { seen.push(n.id); return 'mark'; } });
    expect(specs.map((s) => s.kind)).toEqual(['mark', 'mark']);
    expect(seen).toEqual(['c']);
  });

  it('revives typed arrays inside node data', () => {
    const json: SerializedScene<Data, Layer, Pose> = {
      version: 3,
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
  it('leaves a commands or coords field that holds no numbers as it is', () => {
    const data = { commands: ['undo', 'redo'], coords: { lat: 51.5, lng: -0.1 }, nested: { coords: [[1, 2], [3, 4]] } };
    const revived = reviveTypedArrays(JSON.parse(JSON.stringify(data, serializeReplacer)) as typeof data);
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
      version: 3,
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
    expect(docFromSnapshot({ ...base, doc: { 'app:paper': { size: 'a4' } } })).toEqual({ 'app:paper': { size: 'a4' } });
  });

  it('answers undefined for a snapshot written before document values, or a malformed one', () => {
    expect(docFromSnapshot(base)).toBeUndefined();
    expect(docFromSnapshot({ ...base, doc: [1] as never })).toBeUndefined();
  });
});

describe('a snapshot holding core:pages', () => {
  const legacy: SerializedScene<{ fill?: string }, 'default', RectPose> = {
    version: 3,
    systemLayers: [{ id: 'default' }],
    nodes: [{ id: 'r', kind: 'mark', layer: 'default', pose: { x: 115, y: 10, width: 10, height: 10 }, data: { fill: '#000' } }],
    doc: {
      'core:pages': { pages: [{ id: 'a', width: 100, height: 50 }, { id: 'b', width: 100, height: 50 }], layout: { direction: 'row', gap: 10 } },
      'app:other': 1,
    },
  };

  it('loads its pages as page nodes, with each root on its page', () => {
    const specs = nodeSpecsFromSnapshot(legacy);
    const run = specs.find((s) => s.pageRun !== undefined)!;
    expect(run).toBeDefined();
    expect(specs.filter((s) => s.page !== undefined).map((s) => [s.id, s.parent])).toEqual([['a', run.id], ['b', run.id]]);
    const r = specs.find((s) => s.id === asNodeId('r'))!;
    expect(r.parent).toBe('b');
    expect(r.pose).toMatchObject({ x: 5, y: 10 });
    expect(r.data).toEqual({ fill: '#000' });
  });

  it('loads without the core:pages value, its other values kept', () => {
    expect(docFromSnapshot(legacy)).toEqual({ 'app:other': 1 });
  });

  it('is read the same way twice', () => {
    expect(nodeSpecsFromSnapshot(legacy)).toEqual(nodeSpecsFromSnapshot(legacy));
    expect((legacy.doc as Record<string, unknown>)['core:pages']).toBeDefined();
  });

  it('places each root by the descriptor it is handed', () => {
    // Measures every pose 100 to the left of where its rect says: the rect at x 115 reads as on page a.
    const shifted: PoseDescriptor<unknown> = {
      ...(RECT_POSE_DESCRIPTOR as PoseDescriptor<unknown>),
      getBounds: (pose) => {
        const p = pose as RectPose;
        return { x: p.x - 100, y: p.y, width: p.width, height: p.height };
      },
    };
    const r = nodeSpecsFromSnapshot(legacy, {}, undefined, { descriptor: shifted }).find((s) => s.id === asNodeId('r'))!;
    expect(r.parent).toBe('a');
  });

  it('converts once: a converted snapshot comes back as it is', () => {
    const once = adoptSnapshotPages(legacy);
    expect(adoptSnapshotPages(once)).toBe(once);
    expect(adoptSnapshotPages(adoptSnapshotPages(legacy))).toEqual(once);
  });
});

describe('a snapshot saved without pages', () => {
  const plain: SerializedScene<{ fill?: string }, 'default', RectPose> = {
    version: 3,
    systemLayers: [{ id: 'default' }],
    nodes: [{ id: 'r', kind: 'mark', layer: 'default', pose: { x: 500, y: 10, width: 10, height: 10 }, data: {} }],
  };
  const pages = { pages: [{ id: 'p', width: 100, height: 50 }] };

  it('gets the fallback pages it is given, each root on one, and is left alone without them', () => {
    const specs = nodeSpecsFromSnapshot(plain, {}, undefined, { pages });
    expect(specs.filter((s) => s.page !== undefined).map((s) => s.id)).toEqual(['p']);
    expect(specs.find((s) => s.id === asNodeId('r'))!).toMatchObject({ parent: 'p', pose: { x: 99 } });
    expect(adoptSnapshotPages(plain)).toBe(plain);
  });

  it('rebuilds the tree, as a core:pages one does, and a paged one does not', () => {
    expect([snapshotRebuildsTree(plain), snapshotRebuildsTree(plain, { pages })]).toEqual([false, true]);
    const paged = adoptSnapshotPages(plain, {}, { pages });
    expect(snapshotRebuildsTree(paged, { pages })).toBe(false);
    expect(snapshotRebuildsTree({ nodes: [], doc: { 'core:pages': pages } })).toBe(true);
  });
});
