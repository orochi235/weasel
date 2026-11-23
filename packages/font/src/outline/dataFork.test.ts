import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sfntFromCollection } from './sfnt';
import { sfntResources } from './dataFork';
import { dataFork, tinyFont } from './fontFiles.fixture';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');


const REGULAR = tinyFont('Face-Regular');
const BOLD = tinyFont('Face-Bold');
const FORK = dataFork([
  { type: 'FOND', data: new Uint8Array([1, 2, 3, 4, 5]) },
  { type: 'sfnt', data: REGULAR },
  { type: 'sfnt', data: BOLD },
]);
/** Where the `sfnt` type's reference list starts. */
function sfntReferences(view: DataView): number {
  const mapOffset = view.getUint32(4);
  const typeList = mapOffset + view.getUint16(mapOffset + 24);
  for (let t = 0; t <= view.getUint16(typeList); t++) {
    const entry = typeList + 2 + t * 8;
    if (String.fromCharCode(...new Uint8Array(view.buffer, entry, 4)) === 'sfnt') return typeList + view.getUint16(entry + 6);
  }
  throw new Error('no sfnt type');
}
const asArray = (b: ArrayBuffer): number[] => Array.from(new Uint8Array(b));

describe('a .dfont\'s sfnt resources', () => {
  it('reads each one out whole, past resources of other types', () => {
    expect(sfntResources(FORK).map(asArray)).toEqual([Array.from(REGULAR), Array.from(BOLD)]);
  });

  it('reads a type whose reference count is stored as 0xffff as holding none, as an empty type list does', () => {
    const fork = FORK.slice(0);
    const view = new DataView(fork);
    const mapOffset = view.getUint32(4);
    const typeList = mapOffset + view.getUint16(mapOffset + 24);
    for (let t = 0; t <= view.getUint16(typeList); t++) {
      const entry = typeList + 2 + t * 8;
      if (String.fromCharCode(...new Uint8Array(fork, entry, 4)) === 'sfnt') view.setUint16(entry + 4, 0xffff);
    }
    expect(sfntResources(fork)).toEqual([]);
  });

  it('hands back the first when no face is named', () => {
    const { bytes, matched } = sfntFromCollection(FORK);
    expect(asArray(bytes!)).toEqual(Array.from(REGULAR));
    expect(matched).toBe(true);
  });

  it('selects the one whose PostScript name matches', () => {
    const { bytes, matched } = sfntFromCollection(FORK, 'Face-Bold');
    expect(asArray(bytes!)).toEqual(Array.from(BOLD));
    expect(matched).toBe(true);
  });

  it('cuts out no member, and says so, when none matches', () => {
    const { bytes, matched } = sfntFromCollection(FORK, 'Face-Italic');
    expect(bytes).toBeNull();
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

  it('refuses two references to one resource, rather than copying it once for each', () => {
    const fork = FORK.slice(0);
    const view = new DataView(fork);
    const refs = sfntReferences(view);
    view.setUint32(refs + 12 + 4, view.getUint32(refs + 4));
    expect(() => sfntResources(fork)).toThrow(/\.dfont.*damaged.*overlap/);
  });

  it('refuses a type list that names the sfnt references twice', () => {
    const fork = FORK.slice(0);
    const view = new DataView(fork);
    const mapOffset = view.getUint32(4);
    const typeList = mapOffset + view.getUint16(mapOffset + 24);
    // FORK's types are FOND, then sfnt: point the FOND entry at sfnt's references, under sfnt's tag.
    view.setUint32(typeList + 2, view.getUint32(typeList + 2 + 8));
    view.setUint32(typeList + 2 + 4, view.getUint32(typeList + 2 + 8 + 4));
    expect(() => sfntResources(fork)).toThrow(/\.dfont.*damaged.*overlap/);
  });

  it.skipIf(!existsSync(INTER_TTF))('returns a real font byte for byte', () => {
    const inter = new Uint8Array(readFileSync(INTER_TTF));
    const { bytes, matched } = sfntFromCollection(dataFork([{ type: 'sfnt', data: inter }]), 'Inter-Regular');
    expect(matched).toBe(true);
    expect(new Uint8Array(bytes!)).toEqual(inter);
  });
});
