/**
 * Property tests of reading a saved snapshot, beyond the round trip: reading one parsed snapshot leaves it as it was
 * and reads the same every time, whether through `nodeSpecsFromSnapshot` or `docFromSnapshot`; adopting pages is
 * idempotent, and a snapshot whose pages it adopted no longer rebuilds; and loading under any pages keeps every
 * saved node, root, and data value.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asNodeId, createScene, type PagesDoc, type SerializedScene } from '@weasel-js/core';
import { adoptSnapshotPages, docFromSnapshot, nodeSpecsFromSnapshot, serializeReplacer, snapshotRebuildsTree } from './snapshot';
import { dataKey, dataValue, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

type Pose = { x: number; y: number; width: number; height: number };
type Data = Record<string, unknown>;
type Snap = SerializedScene<Data, 'main', Pose>;

function objectOf(entries: readonly (readonly [string, unknown])[]): Data {
  const out: Data = {};
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}

const pose = fc.record({
  x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }),
  width: fc.integer({ min: 0, max: 200 }), height: fc.integer({ min: 0, max: 200 }),
});
const docKey = fc.constantFrom('app:theme', '__proto__', 'toString', 'constructor', 'core:pages-not');
const pagesDoc: fc.Arbitrary<PagesDoc> = fc.record({
  pages: fc.uniqueArray(fc.record({ id: fc.constantFrom('p', 'q', 'r', 'n0', 'page-run', '__proto__'), width: fc.integer({ min: 1, max: 400 }), height: fc.integer({ min: 1, max: 400 }) }),
    { selector: (p) => p.id, minLength: 1, maxLength: 3 }),
}, { noNullPrototype: true });

/** The text an editor saves for a scene of `nodes` root marks and groups and the document values `doc`, with its
 *  pages as the old `core:pages` value when `legacy` is given. */
const saved = fc.record({
  nodes: fc.array(fc.record({ group: fc.boolean(), nested: fc.boolean(), pose, data: fc.uniqueArray(fc.tuple(dataKey, dataValue), { selector: ([k]) => k, maxLength: 3 }).map(objectOf) }), { maxLength: 5 }),
  doc: fc.uniqueArray(fc.tuple(docKey, fc.oneof(fc.jsonValue({ maxDepth: 2 }), dataValue.filter((v) => !hasTyped(v)))), { selector: ([k]) => k, maxLength: 3 }),
  legacy: fc.option(pagesDoc, { nil: undefined, freq: 2 }),
}).map(({ nodes, doc, legacy }) => {
  const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  let group: string | undefined;
  nodes.forEach((n, i) => {
    const id = `n${i}`;
    scene.add({ id: asNodeId(id), kind: n.group ? 'group' : 'mark', layer: 'main', pose: n.pose, data: n.data, ...(n.nested && group ? { parent: asNodeId(group) } : {}) });
    if (n.group) group = id;
  });
  for (const [k, v] of doc) scene.doc.set(k, v);
  if (legacy) scene.doc.set('core:pages', legacy);
  return JSON.stringify(scene.toJSON(), serializeReplacer);
});

function hasTyped(v: unknown): boolean {
  if (ArrayBuffer.isView(v)) return true;
  if (v === null || typeof v !== 'object') return false;
  return Object.values(v).some(hasTyped);
}

/** JSON of `v` with typed arrays named, so two reads compare alike only if they read alike. */
const shown = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (ArrayBuffer.isView(x) ? { typed: Object.prototype.toString.call(x), v: Array.from(x as Uint8Array) } : x));

describe('reading a saved snapshot', () => {
  it('leaves the parsed snapshot as it was, and reads it the same every time', () => {
    const seen = tally();
    fc.assert(fc.property(saved, fc.option(pagesDoc, { nil: undefined, freq: 2 }), (text, pages) => {
      const json = JSON.parse(text) as Snap;
      const opts = pages ? { pages } : {};
      const first = { specs: shown(nodeSpecsFromSnapshot(json, {}, undefined, opts)), doc: shown(docFromSnapshot(json)) };
      expect(JSON.stringify(json)).toBe(JSON.stringify(JSON.parse(text)));
      const again = { specs: shown(nodeSpecsFromSnapshot(json, {}, undefined, opts)), doc: shown(docFromSnapshot(json)) };
      expect(again).toEqual(first);
      if (/__raw/.test(text)) seen.count('wrapped');
      if (snapshotRebuildsTree(json, opts)) seen.count('rebuilt');
    }), runs(RUNS));
    seen.atLeast('wrapped', RUNS / 10);
    seen.atLeast('rebuilt', RUNS / 4);
  }, timeoutFor(RUNS, 20));

  it('adopts pages once: an adopted snapshot no longer rebuilds, and adopting it again changes nothing', () => {
    const seen = tally();
    fc.assert(fc.property(saved, fc.option(pagesDoc, { nil: undefined, freq: 2 }), (text, pages) => {
      const json = JSON.parse(text) as Snap;
      const opts = pages ? { pages } : {};
      const once = adoptSnapshotPages(json, {}, opts);
      if (!snapshotRebuildsTree(json, opts)) {
        seen.count('kept');
        expect(once).toBe(json);
        return;
      }
      seen.count('adopted');
      expect(snapshotRebuildsTree(once, opts)).toBe(false);
      expect(once.doc?.['core:pages']).toBeUndefined();
      expect(adoptSnapshotPages(once, {}, opts)).toBe(once);
      const ids = new Set(once.nodes.map((n) => n.id));
      expect(ids.size).toBe(once.nodes.length);
      for (const n of json.nodes) expect(ids.has(n.id)).toBe(true);
      const roots = once.nodes.filter((n) => n.parent === undefined || n.parent === null);
      expect(roots.map((n) => n.pageRun !== undefined)).toEqual([true]);
    }), runs(RUNS));
    seen.atLeast('adopted', RUNS / 4);
    seen.atLeast('kept', RUNS / 8);
  }, timeoutFor(RUNS, 20));
});
