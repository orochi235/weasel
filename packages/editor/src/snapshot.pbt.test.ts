/**
 * Property tests of the editor's snapshot reading and writing: any data, typed arrays and lookalikes of what the
 * writer tags anywhere in it, reads back equal through `serializeReplacer` and `reviveTypedArrays`; a scene saved
 * and read back through `nodeSpecsFromSnapshot` rebuilds the same tree; and a fuzzed snapshot loads or is refused
 * with an error the reader names, never a `TypeError`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asNodeId, createScene, type SerializedScene } from '@weasel-js/core';
import { docFromSnapshot, nodeSpecsFromSnapshot, reviveTypedArrays, serializeReplacer, snapshotRebuildsTree } from './snapshot';
import { dataKey, dataValue, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

/** `a` and `b` alike to the last bit, but for the sign of a zero, which JSON does not write: typed arrays of one type
 *  and contents, plain objects with the same own keys. */
function same(a: unknown, b: unknown, at = '$'): string[] {
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    const ok = Object.prototype.toString.call(a) === Object.prototype.toString.call(b)
      && Array.from(a as Float64Array).every((v, i) => Object.is(v + 0, (b as Float64Array)[i]! + 0)) && (a as Float64Array).length === (b as Float64Array).length;
    return ok ? [] : [`${at}: ${String(a)} / ${String(b)}`];
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return [`${at}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`];
    return a.flatMap((v, i) => same(v, b[i], `${at}[${i}]`));
  }
  if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return [`${at}: prototype`];
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.join() !== kb.join()) return [`${at}: keys ${ka} / ${kb}`];
    return ka.flatMap((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`));
  }
  return Object.is(typeof a === 'number' ? a + 0 : a, typeof b === 'number' ? b + 0 : b) ? [] : [`${at}: ${String(a)} / ${String(b)}`];
}

const hop = (v: unknown): unknown => reviveTypedArrays(JSON.parse(JSON.stringify(v, serializeReplacer)));

describe('serializeReplacer and reviveTypedArrays', () => {
  it('read back whatever they write, at any depth, under any key', () => {
    const seen = tally();
    fc.assert(fc.property(dataValue, (v) => {
      const text = JSON.stringify(v, serializeReplacer);
      if (/"__ta"|"commands"|"coords"|"__raw"/.test(text)) seen.count('lookalike or tagged');
      expect(same(hop(v), v)).toEqual([]);
    }), runs(RUNS));
    seen.atLeast('lookalike or tagged', RUNS / 3);
  }, timeoutFor(RUNS, 5));

  it('still read a path an older save wrote untagged', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 5 }), fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { maxLength: 5 }), fc.boolean(),
      (cmds, coords, asObject) => {
        const legacy = (a: number[]) => (asObject ? Object.fromEntries(a.map((n, i) => [String(i), n])) : a);
        const got = reviveTypedArrays(JSON.parse(JSON.stringify({ path: { commands: legacy(cmds), coords: legacy(coords) } }))) as { path: { commands: Uint8Array; coords: Float32Array } };
        expect(same(got.path.commands, Uint8Array.from(cmds))).toEqual([]);
        expect(same(got.path.coords, Float32Array.from(coords))).toEqual([]);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

type Pose = { x: number; y: number; width: number; height: number };
const rect = fc.record({
  x: fc.double({ min: -1e6, max: 1e6, noNaN: true }), y: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
  width: fc.double({ min: 0, max: 1e4, noNaN: true }), height: fc.double({ min: 0, max: 1e4, noNaN: true }),
}).map((p) => ({ x: p.x + 0, y: p.y + 0, width: p.width + 0, height: p.height + 0 }));

const tree = fc.array(fc.record({
  kind: fc.constantFrom('mark' as const, 'group' as const),
  parent: fc.nat(),
  pose: rect,
  data: fc.uniqueArray(fc.tuple(dataKey, dataValue), { selector: ([k]) => k, maxLength: 3 }),
  hidden: fc.boolean(),
}), { maxLength: 8 });

describe('a scene saved and read back', () => {
  it('rebuilds the same nodes, nesting, poses, and data', () => {
    const seen = tally();
    fc.assert(fc.property(tree, (specs) => {
      const scene = createScene<Record<string, unknown>, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
      const groups: string[] = [];
      specs.forEach((s, i) => {
        const id = asNodeId(`n${i}`);
        const parent = groups.length > 0 && s.parent % 3 !== 0 ? groups[s.parent % groups.length] : undefined;
        const data: Record<string, unknown> = {};
        for (const [k, v] of s.data) Object.defineProperty(data, k, { value: v, enumerable: true, writable: true, configurable: true });
        scene.add({ id, kind: s.kind, layer: 'main', pose: s.pose, data, ...(parent ? { parent: asNodeId(parent) } : {}), ...(s.hidden ? { hidden: true } : {}) });
        if (s.kind === 'group') groups.push(id);
      });
      const saved = JSON.parse(JSON.stringify(scene.toJSON(), serializeReplacer)) as SerializedScene<Record<string, unknown>, 'main', Pose>;
      const read = nodeSpecsFromSnapshot(saved);
      const again = createScene<Record<string, unknown>, 'main', Pose>({ systemLayers: [{ id: 'main' }], initial: read });
      seen.count(specs.length > 2 ? 'several' : 'few');
      expect([...again.renderOrder()]).toEqual([...scene.renderOrder()]);
      for (const id of scene.renderOrder()) {
        const a = scene.get(id)!;
        const b = again.get(id)!;
        expect([b.kind, b.parent, b.hidden]).toEqual([a.kind, a.parent, a.hidden]);
        expect(same(b.pose, a.pose)).toEqual([]);
        expect(same(b.data, a.data)).toEqual([]);
      }
    }), runs(RUNS / 3));
    seen.atLeast('several', RUNS / 6);
  }, timeoutFor(RUNS, 20));
});

/** Anything JSON can hold, often shaped like part of a snapshot. */
const junk: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  v: fc.oneof({ depthSize: 'small' }, fc.jsonValue({ maxDepth: 2 }), tie('node'), fc.array(tie('v'), { maxLength: 3 })),
  node: fc.record({
    id: fc.oneof(fc.constantFrom('a', 'b', '__proto__'), fc.jsonValue({ maxDepth: 1 })),
    kind: fc.oneof(fc.constantFrom('mark', 'group', 'leaf', 'container', 'page', 'pageRun'), fc.jsonValue({ maxDepth: 1 })),
    layer: fc.oneof(fc.constantFrom('main', 'nope'), fc.jsonValue({ maxDepth: 1 })),
    // A pose's shape is the app's pose descriptor's to read, not the snapshot reader's.
    pose: rect,
    data: fc.jsonValue({ maxDepth: 2 }),
    parent: fc.jsonValue({ maxDepth: 1 }),
    pageRun: fc.jsonValue({ maxDepth: 1 }),
  }, { requiredKeys: [], noNullPrototype: true }),
})).v;

describe('a fuzzed snapshot', () => {
  it('loads, or is refused with an error the reader names, never a TypeError', () => {
    const seen = tally();
    const page = fc.record({ id: fc.oneof(fc.constantFrom('p', 'q'), fc.jsonValue({ maxDepth: 1 })), width: fc.oneof(fc.integer({ min: 1, max: 500 }), fc.jsonValue({ maxDepth: 1 })), height: fc.oneof(fc.integer({ min: 1, max: 500 }), fc.jsonValue({ maxDepth: 1 })) }, { requiredKeys: [], noNullPrototype: true });
    const pagesValue = fc.oneof(fc.record({ pages: fc.array(page, { maxLength: 3 }) }, { noNullPrototype: true }), fc.jsonValue({ maxDepth: 2 }));
    const doc = fc.oneof(fc.jsonValue({ maxDepth: 2 }), pagesValue.map((v) => ({ 'core:pages': v })));
    const wellFormed = fc.array(fc.record({ id: fc.constantFrom('a', 'b', 'c'), kind: fc.constantFrom('mark', 'group'), layer: fc.constant('main'), pose: rect, data: fc.constant({}) }, { noNullPrototype: true }), { maxLength: 3 });
    fc.assert(fc.property(fc.constantFrom(1, 2, 3), fc.oneof(fc.array(junk, { maxLength: 4 }), { weight: 2, arbitrary: wellFormed }), fc.option(fc.jsonValue({ maxDepth: 2 }), { freq: 2 }), fc.option(doc, { freq: 2 }),
      fc.option(fc.record({ pages: fc.array(fc.record({ id: fc.constantFrom('p', 'q'), width: fc.integer({ min: 1, max: 500 }), height: fc.integer({ min: 1, max: 500 }) }, { noNullPrototype: true }), { maxLength: 2 }) }, { noNullPrototype: true }), { nil: undefined }),
      (version, nodes, systemLayers, doc, pages) => {
        const json = { version, nodes, ...(systemLayers !== null ? { systemLayers } : { systemLayers: [{ id: 'main' }] }), ...(doc !== null ? { doc } : {}) } as unknown as SerializedScene<unknown, 'main', Pose>;
        try {
          snapshotRebuildsTree(json);
          docFromSnapshot(json);
          snapshotRebuildsTree(json, pages !== undefined ? { pages: pages as never } : {});
          nodeSpecsFromSnapshot(json, {}, undefined, pages !== undefined ? { pages: pages as never } : {});
          seen.count('loaded');
        } catch (e) {
          seen.count('refused');
          expect(e).toBeInstanceOf(Error);
          expect((e as Error).constructor.name, (e as Error).stack).not.toMatch(/^(TypeError|RangeError|ReferenceError)$/);
        }
      }), runs(RUNS));
    seen.atLeast('loaded', RUNS / 10);
    seen.atLeast('refused', RUNS / 10);
  }, timeoutFor(RUNS, 10));
});
