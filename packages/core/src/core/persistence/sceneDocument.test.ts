import { describe, expect, it } from 'vitest';
import { asPolygonPath, rectPath } from '@weasel-js/geom';
import { createScene, sceneFromJSON } from '../scene';
import { SnapshotShapeError } from '../scene/snapshotShape';
import { SCENE_HISTORY_FORM } from '../scene/historyForm';
import { encodeSnapshot } from './codec';
import {
  SCENE_DOCUMENT_FORMAT, decodeSceneDocument, encodeSceneDocument, pairHistory, restorePairedHistory, sceneFingerprint,
} from './sceneDocument';

type Pose = { x: number; y: number; width: number; height: number };
const LAYERS = [{ id: 'main' as const }];

function drawn() {
  const scene = createScene<Record<string, unknown>, 'main', Pose>({ systemLayers: LAYERS });
  const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { path: asPolygonPath(rectPath(0, 0, 10, 10)) } });
  scene.setPose(id, { x: 5, y: 5, width: 10, height: 10 });
  return { scene, id };
}

/** Through text, as a file or `localStorage` keeps it. */
const viaText = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));

describe('the scene document', () => {
  it('saves and restores a scene and its history with core alone', () => {
    const { scene, id } = drawn();
    const file = viaText(encodeSceneDocument(scene));
    const doc = decodeSceneDocument<Record<string, unknown>, 'main', Pose>(file);
    const loaded = sceneFromJSON(doc.scene);
    expect(restorePairedHistory(loaded, doc.history)).toBe('restored');
    expect(loaded.history.canUndo()).toBe(true);
    loaded.history.undo();
    expect(loaded.get(id)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('leaves the history out when asked', () => {
    const { scene } = drawn();
    expect(encodeSceneDocument(scene, { history: false }).history).toBeUndefined();
  });

  it('refuses to restore a history over a scene it was not saved with', () => {
    const { scene } = drawn();
    const paired = viaText(pairHistory(scene));
    const other = createScene<Record<string, unknown>, 'main', Pose>({ systemLayers: LAYERS });
    other.add({ kind: 'mark', layer: 'main', pose: { x: 1, y: 1, width: 1, height: 1 }, data: {} });
    expect(restorePairedHistory(other, paired)).toBe('mismatched');
    expect(other.history.undoDepth()).toBe(1);
  });

  it('refuses a history once the loaded content has changed, as by an application migration', () => {
    const { scene, id } = drawn();
    const doc = decodeSceneDocument<Record<string, unknown>, 'main', Pose>(viaText(encodeSceneDocument(scene)));
    const loaded = sceneFromJSON(doc.scene);
    loaded.untracked(() => loaded.update(id, { data: { migrated: true } }));
    expect(restorePairedHistory(loaded, doc.history)).toBe('mismatched');
  });

  it('reads a history saved without a pairing as unpaired', () => {
    const { scene } = drawn();
    const fresh = sceneFromJSON(scene.toJSON());
    expect(restorePairedHistory(fresh, encodeSnapshot(scene.serializeHistory()))).toBe('unpaired');
    expect(restorePairedHistory(fresh, null)).toBe('unpaired');
  });

  it('reads a history in another recorded form as stale', () => {
    const { scene } = drawn();
    const paired = pairHistory(scene);
    const old = { ...paired, history: { ...(paired.history as object), form: SCENE_HISTORY_FORM - 1 } };
    expect(restorePairedHistory(sceneFromJSON(scene.toJSON()), old)).toBe('stale');
  });

  it('fingerprints state, not identity', () => {
    const { scene } = drawn();
    expect(sceneFingerprint(sceneFromJSON(scene.toJSON()).toJSON())).toBe(sceneFingerprint(scene.toJSON()));
  });

  it('refuses a value that is not an envelope, or a malformed scene in one', () => {
    const { scene } = drawn();
    expect(() => decodeSceneDocument(scene.toJSON())).toThrow(SnapshotShapeError);
    const later = { ...viaText(encodeSceneDocument(scene)) as object, version: 2 };
    expect(() => decodeSceneDocument(later)).toThrow(/unsupported version 2/);
    expect(() => decodeSceneDocument({ format: SCENE_DOCUMENT_FORMAT, version: 1, scene: { version: 3 } })).toThrow(SnapshotShapeError);
  });
});
