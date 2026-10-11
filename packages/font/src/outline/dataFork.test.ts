import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sfntFromCollection } from './sfnt';
import { sfntResources } from './dataFork';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

/** The smallest sfnt that can be told apart: one `name` table holding a
 *  Macintosh-encoded PostScript name. */
function tinyFont(postScriptName: string): Uint8Array {
  const nameTable = 6 + 12 + postScriptName.length;
  const out = new Uint8Array(12 + 16 + nameTable);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 1);
  [...'name'].forEach((ch, i) => view.setUint8(12 + i, ch.charCodeAt(0)));
  view.setUint32(12 + 8, 28);
  view.setUint32(12 + 12, nameTable);
  view.setUint16(28 + 2, 1);            // one record
  view.setUint16(28 + 4, 18);           // strings follow it
  view.setUint16(28 + 6, 1);            // platform: Macintosh
  view.setUint16(28 + 6 + 6, 6);        // nameID 6
  view.setUint16(28 + 6 + 8, postScriptName.length);
  [...postScriptName].forEach((ch, i) => view.setUint8(28 + 18 + i, ch.charCodeAt(0)));
  return out;
}

/** A resource fork holding `resources`, each under its four-letter type. */
function dataFork(resources: ReadonlyArray<{ type: string; data: Uint8Array }>): ArrayBuffer {
  const dataOffset = 256;
  const dataLength = resources.reduce((n, r) => n + 4 + r.data.length, 0);
  const types = [...new Set(resources.map((r) => r.type))];
  const typeList = 2 + types.length * 8;
  const mapLength = 28 + typeList + resources.length * 12;
  const mapOffset = dataOffset + dataLength;
  const out = new ArrayBuffer(mapOffset + mapLength);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, dataOffset);
  view.setUint32(4, mapOffset);
  view.setUint32(8, dataLength);
  view.setUint32(12, mapLength);

  const dataAt = new Map<Uint8Array, number>();
  let cursor = 0;
  for (const r of resources) {
    dataAt.set(r.data, cursor);
    view.setUint32(dataOffset + cursor, r.data.length);
    bytes.set(r.data, dataOffset + cursor + 4);
    cursor += 4 + r.data.length;
  }

  const typeListAt = mapOffset + 28;
  view.setUint16(mapOffset + 24, 28);
  view.setUint16(mapOffset + 26, mapLength);
  view.setUint16(typeListAt, types.length - 1);
  let refAt = typeList;
  types.forEach((type, t) => {
    const mine = resources.filter((r) => r.type === type);
    const entry = typeListAt + 2 + t * 8;
    [...type].forEach((ch, i) => view.setUint8(entry + i, ch.charCodeAt(0)));
    view.setUint16(entry + 4, mine.length - 1);
    view.setUint16(entry + 6, refAt);
    mine.forEach((r, i) => {
      const ref = typeListAt + refAt + i * 12;
      view.setUint16(ref, 128 + i);
      view.setUint16(ref + 2, 0xffff);
      const off = dataAt.get(r.data)!;
      view.setUint8(ref + 5, (off >> 16) & 0xff);
      view.setUint8(ref + 6, (off >> 8) & 0xff);
      view.setUint8(ref + 7, off & 0xff);
    });
    refAt += mine.length * 12;
  });
  return out;
}

const REGULAR = tinyFont('Face-Regular');
const BOLD = tinyFont('Face-Bold');
const FORK = dataFork([
  { type: 'FOND', data: new Uint8Array([1, 2, 3, 4, 5]) },
  { type: 'sfnt', data: REGULAR },
  { type: 'sfnt', data: BOLD },
]);
const asArray = (b: ArrayBuffer): number[] => Array.from(new Uint8Array(b));

describe('a .dfont\'s sfnt resources', () => {
  it('reads each one out whole, past resources of other types', () => {
    expect(sfntResources(FORK).map(asArray)).toEqual([Array.from(REGULAR), Array.from(BOLD)]);
  });

  it('hands back the first when no face is named', () => {
    const { bytes, matched } = sfntFromCollection(FORK);
    expect(asArray(bytes)).toEqual(Array.from(REGULAR));
    expect(matched).toBe(true);
  });

  it('selects the one whose PostScript name matches', () => {
    const { bytes, matched } = sfntFromCollection(FORK, 'Face-Bold');
    expect(asArray(bytes)).toEqual(Array.from(BOLD));
    expect(matched).toBe(true);
  });

  it('falls back to the first, and says so, when none matches', () => {
    const { bytes, matched } = sfntFromCollection(FORK, 'Face-Italic');
    expect(asArray(bytes)).toEqual(Array.from(REGULAR));
    expect(matched).toBe(false);
  });

  it('refuses a fork with no sfnt resource, by name', () => {
    const fork = dataFork([{ type: 'FOND', data: new Uint8Array(4) }]);
    expect(() => sfntFromCollection(fork)).toThrow(/\.dfont.*no sfnt/);
  });

  it('refuses a resource that runs past its data segment', () => {
    const fork = dataFork([{ type: 'sfnt', data: REGULAR }]);
    new DataView(fork).setUint32(256, REGULAR.length + 4096);
    expect(() => sfntFromCollection(fork)).toThrow(/\.dfont.*truncated/);
  });

  it.skipIf(!existsSync(INTER_TTF))('returns a real font byte for byte', () => {
    const inter = new Uint8Array(readFileSync(INTER_TTF));
    const { bytes, matched } = sfntFromCollection(dataFork([{ type: 'sfnt', data: inter }]), 'Inter-Regular');
    expect(matched).toBe(true);
    expect(new Uint8Array(bytes)).toEqual(inter);
  });
});
