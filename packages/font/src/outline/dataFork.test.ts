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
