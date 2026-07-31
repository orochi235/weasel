import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isFontCollection, sfntFromCollection } from './sfnt';

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

/**
 * Build a two-member collection out of one real font, by writing a `ttcf`
 * header in front of two copies of its table directory that both point at the
 * same table bytes. That is exactly the structure a real `.ttc` has — N
 * directories over one shared pool — so unpacking either member has to
 * reproduce the original font.
 */
function synthesizeCollection(single: ArrayBuffer): ArrayBuffer {
  const src = new DataView(single);
  const numTables = src.getUint16(4);
  const dirBytes = 12 + numTables * 16;
  const header = 12 + 2 * 4;               // ttcf header + two member offsets
  const total = header + dirBytes * 2 + single.byteLength;

  const out = new ArrayBuffer(total);
  const dst = new DataView(out);
  const dstBytes = new Uint8Array(out);

  for (const [i, ch] of [...'ttcf'].entries()) dst.setUint8(i, ch.charCodeAt(0));
  dst.setUint16(4, 1); dst.setUint16(6, 0);
  dst.setUint32(8, 2);
  dst.setUint32(12, header);
  dst.setUint32(16, header + dirBytes);

  // The shared table pool: the whole original font, tables reachable at their
  // original offsets plus this shift.
  const poolAt = header + dirBytes * 2;
  dstBytes.set(new Uint8Array(single), poolAt);

  for (const member of [header, header + dirBytes]) {
    dstBytes.set(new Uint8Array(single, 0, dirBytes), member);
    for (let i = 0; i < numTables; i++) {
      const at = member + 12 + i * 16;
      dst.setUint32(at + 8, src.getUint32(12 + i * 16 + 8) + poolAt);
    }
  }
  return out;
}

describe.skipIf(!existsSync(INTER_TTF))('sfnt collection unpacking', () => {
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

  it('selects the member whose PostScript name matches', () => {
    const collection = synthesizeCollection(interBytes());
    // Both synthesized members are the same face, so the real assertion is
    // that a name that IS present matches, and one that is not falls back
    // rather than throwing — a browser reporting a name the `name` table
    // spells differently should still get some weight of the right family.
    expect(sfntFromCollection(collection, 'Inter-Regular').matched).toBe(true);
    expect(sfntFromCollection(collection, 'NoSuchFace-Bold').matched).toBe(false);
    expect(sfntFromCollection(collection, 'NoSuchFace-Bold').bytes.byteLength)
      .toBeGreaterThan(0);
  });
});
