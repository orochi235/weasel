/**
 * The scene document's readers as fuzz targets. Junk, and a saved document with one field dropped, duplicated or
 * retyped, either load or are refused with the error the reader documents; nothing else is thrown, and nothing
 * reaches `Object.prototype`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asPolygonPath, rectPath } from '@weasel-js/geom';
import { HistoryRestoreError } from '@weasel-js/history';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createScene, sceneFromJSON } from '../scene';
import { SnapshotKeyError, SnapshotShapeError } from '../scene/snapshotShape';
import { decodeSnapshot, parseSnapshot } from './codec';
import { decodeSceneDocument, encodeSceneDocument, restorePairedHistory } from './sceneDocument';
import { junk, mutate, mutated, prototypePolluted } from './hostile.fixture';

const RUNS = 200;

type Pose = { x: number; y: number; width: number; height: number };

function savedDocument(): unknown {
  const scene = createScene<Record<string, unknown>, 'main' | 'top', Pose>({ systemLayers: [{ id: 'main' }, { id: 'top' }] });
  const g = scene.add({ kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 20, height: 20 }, data: { name: 'g' } });
  const a = scene.add({ kind: 'mark', layer: 'main', parent: g, pose: { x: 1, y: 1, width: 5, height: 5 }, data: { path: asPolygonPath(rectPath(0, 0, 5, 5)), fill: '#f00' } });
  scene.add({ kind: 'mark', layer: 'top', pose: { x: 9, y: 9, width: 2, height: 2 }, data: { n: Number.POSITIVE_INFINITY } });
  scene.setPose(a, { x: 2, y: 2, width: 5, height: 5 });
  scene.update(a, { data: { fill: '#0f0' } });
  return JSON.parse(JSON.stringify(encodeSceneDocument(scene))) as unknown;
}

const VALID = savedDocument();

type ErrorClass = abstract new (...a: never[]) => Error;

/** What the engine throws when code reads a value it never checked: never a refusal. */
const ENGINE_ERRORS: readonly ErrorClass[] = [TypeError, RangeError, ReferenceError, SyntaxError];

/** Runs `read`; a throw it documents is a refusal, anything else fails the property. `sceneFromJSON` documents an
 *  error naming the scene for one it cannot build (a cross-layer subtree, a colliding id, a pose it cannot fold). */
function readOrRefuse(read: () => void, documented: readonly ErrorClass[]): 'read' | 'refused' {
  try {
    read();
    return 'read';
  } catch (err) {
    if (documented.some((E) => err instanceof E)) return 'refused';
    if (documented === LOAD && err instanceof Error && !ENGINE_ERRORS.some((E) => err instanceof E) && /^(sceneFromJSON|Scene)\b/.test(err.message)) return 'refused';
    throw err;
  }
}

const SHAPE: readonly ErrorClass[] = [SnapshotShapeError];
const LOAD: readonly ErrorClass[] = [SnapshotShapeError, SnapshotKeyError];

function load(value: unknown): void {
  const doc = decodeSceneDocument<Record<string, unknown>, string, Pose>(value);
  const scene = sceneFromJSON(doc.scene);
  readOrRefuse(() => restorePairedHistory(scene, doc.history), [HistoryRestoreError]);
}

describe('the scene document as a fuzz target', () => {
  it('reads a saved document, and loads it', () => {
    expect(readOrRefuse(() => load(VALID), LOAD)).toBe('read');
  });

  it('refuses junk with a SnapshotShapeError, and leaves Object.prototype alone', () => {
    fc.assert(fc.property(junk, (v) => {
      readOrRefuse(() => load(v), LOAD);
      readOrRefuse(() => decodeSnapshot(v), SHAPE);
      expect(prototypePolluted()).toBe(false);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 5));

  it('loads or refuses a saved document with one field dropped, duplicated or retyped', () => {
    const seen = tally();
    fc.assert(fc.property(mutated(fc.constant(VALID)), ({ value }) => {
      seen.count(readOrRefuse(() => load(value), LOAD));
      expect(prototypePolluted()).toBe(false);
    }), runs(RUNS * 3));
    seen.atLeast('read', RUNS / 4);
    seen.atLeast('refused', RUNS / 10);
  }, timeoutFor(RUNS * 3, 10));

  it('reads any text as a snapshot or throws a SyntaxError, the only error JSON text has', () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.json(), junk.map((v) => JSON.stringify(v) ?? '')), (text) => {
      readOrRefuse(() => parseSnapshot(text), [SyntaxError, SnapshotShapeError]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('refuses a document nested past any real one, quickly', () => {
    const deep = 100_000;
    const t0 = performance.now();
    const text = `{"format":"weasel/scene-document","version":1,"scene":${'['.repeat(deep)}${']'.repeat(deep)}}`;
    expect(readOrRefuse(() => load(JSON.parse(text)), LOAD)).toBe('refused');
    expect(performance.now() - t0).toBeLessThan(2_000);
  });
});

describe('the scene document, shrunk counterexamples', () => {
  it('refuses a paired history whose entry lost its baseOps with a HistoryRestoreError, not a TypeError', () => {
    const doc = mutate(VALID, ['history', 'history', 'undoStack', 0, 'baseOps'], { op: 'drop' });
    const { scene, history } = decodeSceneDocument<Record<string, unknown>, string, Pose>(doc);
    const loaded = sceneFromJSON(scene);
    expect(() => restorePairedHistory(loaded, history)).toThrow(HistoryRestoreError);
    expect(restorePairedHistory(loaded, history, { recovery: 'best-effort' }))
      .toEqual({ status: 'restored', report: { restored: false, unresolved: [] } });
    expect(loaded.history.canUndo()).toBe(false);
  });

  it('reads an object inside a tagged typed array as NaN rather than throwing a TypeError', () => {
    const got = decodeSnapshot(JSON.parse('{"__ta":"f32","data":[{"toString":0,"valueOf":0}, 1]}')) as Float32Array;
    expect(Array.from(got)).toEqual([Number.NaN, 1]);
  });
});
