import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDataForkFont, isFontCollection, sfntFromCollection } from './sfnt';
import { createOpenTypeParser } from './opentypeParser';
import { synthesizeCollection } from './fontFiles.fixture';

// packages/font/src/outline -> repo root
const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

function interBytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function tag(view: DataView, at: number): string {
  return String.fromCharCode(
    view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
}

function tableMap(bytes: ArrayBuffer): Map<string, Uint8Array> {
  const view = new DataView(bytes);
  const n = view.getUint16(4);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16;
    const offset = view.getUint32(at + 8);
    const length = view.getUint32(at + 12);
    out.set(tag(view, at), new Uint8Array(bytes, offset, length));
  }
  return out;
}

/** A minimal Macintosh resource fork: the 16-byte header's four offsets,
 *  with a data segment and a map segment that tile the file exactly. That
 *  consistency is the whole signal — a `.dfont` opens with no magic. */
function synthesizeDataFork(dataLength = 64, mapLength = 32): ArrayBuffer {
  const dataOffset = 256;
  const total = dataOffset + dataLength + mapLength;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, dataOffset);
  view.setUint32(4, dataOffset + dataLength);   // map follows the data
  view.setUint32(8, dataLength);
  view.setUint32(12, mapLength);
  return out;
}

describe('dfont detection', () => {
  it('recognizes a resource-fork header', () => {
    expect(isDataForkFont(synthesizeDataFork())).toBe(true);
  });

  it('declines an empty one by name rather than reaching the parser', () => {
    expect(() => sfntFromCollection(synthesizeDataFork()))
      .toThrow(/\.dfont/);
  });

  it('does not claim bytes too short to hold the header', () => {
    expect(isDataForkFont(new ArrayBuffer(8))).toBe(false);
  });

  it('a signature wins over the offset heuristic', () => {
    // Byte-consistent by construction, but it says `ttcf` — the signature
    // check has to run first or a real collection could be misread.
    const fork = synthesizeDataFork();
    const view = new DataView(fork);
    for (const [i, ch] of [...'ttcf'].entries()) view.setUint8(i, ch.charCodeAt(0));
    expect(isDataForkFont(fork)).toBe(false);
  });
});

describe.skipIf(!existsSync(INTER_TTF))('sfnt collection unpacking', () => {
  it('a real font is not mistaken for a resource fork', () => {
    expect(isDataForkFont(interBytes())).toBe(false);
  });

  it('passes a single font through untouched', () => {
    const bytes = interBytes();
    expect(isFontCollection(bytes)).toBe(false);
    const { bytes: out, matched } = sfntFromCollection(bytes);
    expect(out).toBe(bytes);
    expect(matched).toBe(true);
  });

  it('unpacks a collection member back to an equivalent standalone font', () => {
    const single = interBytes();
    const collection = synthesizeCollection(single);
    expect(isFontCollection(collection)).toBe(true);

    const { bytes: out } = sfntFromCollection(collection);
    expect(isFontCollection(out)).toBe(false);

    // Table *bytes* must survive exactly — they are copied, never re-encoded,
    // which is what lets the directory's original checksums stay valid.
    const before = tableMap(single);
    const after = tableMap(out);
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [name, data] of before) {
      expect(Array.from(after.get(name)!)).toEqual(Array.from(data));
    }
  });

  it('refuses a collection cut off before the end of a table', () => {
    const collection = synthesizeCollection(interBytes());
    const truncated = collection.slice(0, collection.byteLength - 1024);
    expect(() => sfntFromCollection(truncated)).toThrow(/truncated/);
  });

  it('selects the member whose PostScript name matches', () => {
    const collection = synthesizeCollection(interBytes());
    expect(sfntFromCollection(collection, 'Inter-Regular').matched).toBe(true);
    expect(sfntFromCollection(collection, 'NoSuchFace-Bold').matched).toBe(false);
    expect(sfntFromCollection(collection, 'NoSuchFace-Bold').bytes.byteLength)
      .toBeGreaterThan(0);
  });

  it('still unpacks a member when another member\'s name table lies past the end of the file', () => {
    const collection = synthesizeCollection(interBytes());
    const view = new DataView(collection);
    const second = view.getUint32(16);
    for (let i = 0; i < view.getUint16(second + 4); i++) {
      const at = second + 12 + i * 16;
      if (tag(view, at) === 'name') view.setUint32(at + 8, collection.byteLength + 64);
    }
    const { matched, names, bytes } = sfntFromCollection(collection, 'Inter-Regular');
    expect(matched).toBe(true);
    expect(names).toEqual(['Inter-Regular', null]);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('names every member, so a caller can say what it was offered', () => {
    const collection = synthesizeCollection(interBytes());
    expect(sfntFromCollection(collection, 'NoSuchFace-Bold').names).toEqual(['Inter-Regular', 'Inter-Regular']);
  });

  it('the parser rejects a member it was asked for by a name the collection does not hold', async () => {
    const collection = synthesizeCollection(interBytes());
    await expect(createOpenTypeParser('NoSuchFace-Bold')(collection))
      .rejects.toThrow(/"NoSuchFace-Bold".*Inter-Regular/);
    await expect(createOpenTypeParser('Inter-Regular')(collection)).resolves.toBeTruthy();
    await expect(createOpenTypeParser()(collection)).resolves.toBeTruthy();
  });
});
