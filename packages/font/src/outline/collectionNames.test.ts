import { describe, expect, it } from 'vitest';
import { collectionNamesOf, isDataForkFont, isFontCollection, sfntFromCollection } from '../index';
import { dataFork, tinyFont } from './fontFiles.fixture';

/** A `ttcf` collection of `fonts`, each a one-table sfnt whose table directory is rewritten to its new offset. */
function collectionOf(fonts: readonly Uint8Array[]): ArrayBuffer {
  const header = 12 + fonts.length * 4;
  const out = new Uint8Array(header + fonts.reduce((n, f) => n + f.length, 0));
  const view = new DataView(out.buffer);
  [...'ttcf'].forEach((ch, i) => view.setUint8(i, ch.charCodeAt(0)));
  view.setUint16(4, 1);
  view.setUint32(8, fonts.length);
  let at = header;
  fonts.forEach((font, i) => {
    view.setUint32(12 + i * 4, at);
    out.set(font, at);
    const tables = view.getUint16(at + 4);
    for (let t = 0; t < tables; t++) {
      const offset = at + 12 + t * 16 + 8;
      view.setUint32(offset, view.getUint32(offset) + at);
    }
    at += font.length;
  });
  return out.buffer;
}

describe('collectionNamesOf', () => {
  it('names each member of a collection in file order', () => {
    const ttc = collectionOf([tinyFont('Probe-Regular'), tinyFont('Probe-Bold')]);
    expect(isFontCollection(ttc)).toBe(true);
    expect(collectionNamesOf(ttc)).toEqual(['Probe-Regular', 'Probe-Bold']);
  });

  it('names each sfnt resource of a .dfont', () => {
    const dfont = dataFork([
      { type: 'sfnt', data: tinyFont('Probe-Regular') },
      { type: 'sfnt', data: tinyFont('Probe-Italic') },
    ]);
    expect(isDataForkFont(dfont)).toBe(true);
    expect(collectionNamesOf(dfont)).toEqual(['Probe-Regular', 'Probe-Italic']);
  });

  it('keeps an unnamed member\'s place, so a name\'s index is its member\'s', () => {
    const unnamed = tinyFont('Probe-Regular');
    new DataView(unnamed.buffer).setUint16(28 + 6 + 6, 4); // nameID 4, the full name, not 6
    const ttc = collectionOf([unnamed, tinyFont('Probe-Bold')]);
    expect(collectionNamesOf(ttc)).toEqual([null, 'Probe-Bold']);
    expect(sfntFromCollection(ttc, 'Probe-Bold').bytes).not.toBeNull();
  });

  it('is empty for a single font', () => {
    expect(collectionNamesOf(tinyFont('Probe-Regular').buffer as ArrayBuffer)).toEqual([]);
  });

  it('cuts the member it names out of a real collection', () => {
    const ttc = collectionOf([tinyFont('Probe-Regular'), tinyFont('Probe-Bold')]);
    const { bytes, matched } = sfntFromCollection(ttc, 'Probe-Bold');
    expect(matched).toBe(true);
    expect(collectionNamesOf(bytes!)).toEqual([]);
    // Past the header, whose binary-search hint is recomputed, the member is the font it was built from.
    expect(Array.from(new Uint8Array(bytes!, 12))).toEqual(Array.from(tinyFont('Probe-Bold').subarray(12)));
  });
});
