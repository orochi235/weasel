/** Counterexamples the snapshot property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { replaceDoc } from './docValues';
import { SnapshotShapeError } from './snapshotShape';

const LAYERS = [{ id: 'a' }];

describe('snapshots, shrunk counterexamples', () => {
  it('refuses a snapshot whose nodes are not a list with a SnapshotShapeError, and loadState keeps the document', () => {
    const broken = { version: 3, systemLayers: LAYERS, nodes: null };
    expect(() => sceneFromJSON(broken as never)).toThrow(SnapshotShapeError);
    const scene = createScene<Record<string, never>, 'a', { x: number }>({ systemLayers: [{ id: 'a' }] });
    scene.add({ id: 'kept' as never, kind: 'mark', layer: 'a', pose: { x: 1 }, data: {} });
    const was = JSON.stringify(scene.toJSON());
    expect(() => scene.loadState(broken as never)).toThrow(SnapshotShapeError);
    expect(JSON.stringify(scene.toJSON())).toBe(was);
  });

  it('refuses a node that is not an object, and layers that are not a list', () => {
    expect(() => sceneFromJSON({ version: 3, systemLayers: LAYERS, nodes: [null] } as never)).toThrow(SnapshotShapeError);
    expect(() => sceneFromJSON({ version: 3, systemLayers: null, nodes: [] } as never)).toThrow(SnapshotShapeError);
  });

  it('replaceDoc clears a value named like an Object.prototype member', () => {
    const scene = createScene<Record<string, never>, 'a', { x: number }>({ systemLayers: [{ id: 'a' }] });
    scene.doc.set('toString', 1);
    scene.batch('replace', () => replaceDoc(scene, {}));
    expect(scene.doc.keys()).toEqual([]);
  });
});
