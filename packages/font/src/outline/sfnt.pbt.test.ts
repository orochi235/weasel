/**
 * Containers fuzzed: a collection over the repo's Inter, a resource fork of small fonts, and arbitrary bytes, each
 * cut, overwritten, and zeroed. Unpacking either hands back a well-formed font or throws an error naming the
 * container, never an out-of-range read.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { interBytes, mutate, mutations, runs, tally, timeoutFor } from '../pbt.fixture';
import { dataFork, synthesizeCollection, tinyFont } from './fontFiles.fixture';
import { isDataForkFont, isFontCollection, sfntFromCollection } from './sfnt';

const RUNS = 400;
const COLLECTION = synthesizeCollection(interBytes());
/** The `ttcf` header and both table directories: everything before the shared pool of tables. */
const COLLECTION_HEAD = 20 + 2 * (12 + 14 * 16);
const FORK = dataFork([
  { type: 'FOND', data: new Uint8Array([1, 2, 3, 4, 5]) },
  { type: 'sfnt', data: tinyFont('Face-Regular') },
  { type: 'sfnt', data: tinyFont('Face-Bold') },
]);
const NAMES = fc.constantFrom(undefined, 'Inter-Regular', 'Face-Bold', 'Face-Regular', 'Nope');

/** Unpack, and check what came back or what was thrown; the outcome's name. */
function unpack(bytes: ArrayBuffer, name: string | undefined): string {
  const kind = isDataForkFont(bytes) ? 'dfont' : isFontCollection(bytes) ? 'collection' : 'single';
  let out: ReturnType<typeof sfntFromCollection>;
  try {
    out = sfntFromCollection(bytes, name);
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(RangeError);
    expect(err).not.toBeInstanceOf(TypeError);
    expect((err as Error).message).toMatch(kind === 'dfont' ? /\.dfont/ : /font collection/);
    return `${kind}-refused`;
  }
  if (kind === 'single') {
    expect(out.bytes).toBe(bytes);
    expect(out.matched).toBe(true);
    return kind;
  }
  expect(out.matched).toBe(name === undefined || out.names.includes(name));
  if (kind === 'collection') {
    const v = new DataView(out.bytes);
    const count = v.getUint16(4);
    expect(12 + count * 16).toBeLessThanOrEqual(out.bytes.byteLength);
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16;
      expect(v.getUint32(at + 8) + v.getUint32(at + 12)).toBeLessThanOrEqual(out.bytes.byteLength);
    }
  } else {
    expect(out.bytes.byteLength).toBeLessThanOrEqual(bytes.byteLength);
  }
  return kind;
}

describe('sfntFromCollection, fuzzed', () => {
  it('unpacks a damaged collection or refuses it by name', () => {
    const t = tally();
    fc.assert(fc.property(mutations(), fc.boolean(), NAMES, (edits, headOnly, name) => {
      t.count(unpack(mutate(COLLECTION, edits, 0, headOnly ? COLLECTION_HEAD : COLLECTION.byteLength), name));
    }), runs(RUNS));
    t.atLeast('collection', 20);
    t.atLeast('collection-refused', 20);
  }, timeoutFor(RUNS, 3));

  it('unpacks a damaged resource fork or refuses it by name', () => {
    const t = tally();
    fc.assert(fc.property(mutations(), NAMES, (edits, name) => {
      t.count(unpack(mutate(FORK, edits), name));
    }), runs(RUNS));
    t.atLeast('dfont', 20);
    t.atLeast('dfont-refused', 5);
  }, timeoutFor(RUNS, 2));

  it('unpacks arbitrary bytes behind a collection signature or refuses them by name', () => {
    const t = tally();
    const ttcf = [0x74, 0x74, 0x63, 0x66];
    fc.assert(fc.property(fc.uint8Array({ maxLength: 96 }), fc.boolean(), NAMES, (tail, signed, name) => {
      const bytes = new Uint8Array([...(signed ? ttcf : []), ...tail]).buffer;
      t.count(unpack(bytes, name));
    }), runs(RUNS));
    t.atLeast('collection-refused', 20);
    t.atLeast('single', 20);
  }, timeoutFor(RUNS, 1));
});

describe('sfntFromCollection, shrunk', () => {
  it('refuses a collection signature with no header behind it', () => {
    expect(() => sfntFromCollection(new Uint8Array([0x74, 0x74, 0x63, 0x66]).buffer)).toThrow(/font collection is truncated/);
  });

  it('refuses a collection whose member count runs its offsets past the end of the file', () => {
    const bytes = COLLECTION.slice(0);
    new DataView(bytes).setUint32(5, 0x10001);
    expect(() => sfntFromCollection(bytes)).toThrow(/font collection is truncated/);
  });
});
