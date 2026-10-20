import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fontEmbedding } from './fontEmbedding';
import { _resetFontOutlinesForTests, registerFontOutlines } from './outlineRegistry';
import { createOpenTypeParser, openTypeParser } from './opentypeParser';
import { sfntFromCollection } from './sfnt';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

function interBytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  // Built in this test's realm: the registry's `instanceof ArrayBuffer` rejects Node's.
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

/** A one-member `ttcf` wrapper: header, one table directory, then the whole font as the table pool. */
function oneMemberCollection(single: ArrayBuffer): ArrayBuffer {
  const src = new DataView(single);
  const numTables = src.getUint16(4);
  const dirBytes = 12 + numTables * 16;
  const header = 16;
  const out = new ArrayBuffer(header + dirBytes + single.byteLength);
  const dst = new DataView(out);
  const bytes = new Uint8Array(out);
  [...'ttcf'].forEach((ch, i) => dst.setUint8(i, ch.charCodeAt(0)));
  dst.setUint16(4, 1);
  dst.setUint32(8, 1);
  dst.setUint32(12, header);
  const poolAt = header + dirBytes;
  bytes.set(new Uint8Array(single), poolAt);
  bytes.set(new Uint8Array(single, 0, dirBytes), header);
  for (let i = 0; i < numTables; i++) {
    const at = header + 12 + i * 16 + 8;
    dst.setUint32(at, src.getUint32(12 + i * 16 + 8) + poolAt);
  }
  return out;
}

function tableOffset(bytes: ArrayBuffer, tag: string): number {
  const view = new DataView(bytes);
  for (let i = 0; i < view.getUint16(4); i++) {
    const at = 12 + i * 16;
    const t = String.fromCharCode(...[0, 1, 2, 3].map((k) => view.getUint8(at + k)));
    if (t === tag) return view.getUint32(at + 8);
  }
  throw new Error(`no ${tag} table`);
}

afterEach(() => _resetFontOutlinesForTests());

describe('fontEmbedding', () => {
  it('answers the registered TrueType face with its glyph map', async () => {
    registerFontOutlines('emb-inter', {}, interBytes());
    const e = (await fontEmbedding('emb-inter', 400, 'normal'))!;
    expect(e.outlines).toBe('truetype');
    expect(e.embeddable).toBe(true);
    expect(e.unitsPerEm).toBeGreaterThan(0);
    expect(e.postScriptName.length).toBeGreaterThan(0);
    expect(e.glyphIndexOf(0x41)).toBeGreaterThan(0);
    expect(e.glyphIndexOf(0x1f600)).toBeNull();
    expect(e.advanceOfGlyph(e.glyphIndexOf(0x41)!)).toBeGreaterThan(0);
    expect(new Uint8Array(e.sfnt, 0, 4)).toEqual(new Uint8Array([0, 1, 0, 0]));
  });

  it('answers null for a family with nothing registered', async () => {
    expect(await fontEmbedding('nobody', 400, 'normal')).toBeNull();
  });

  it('answers null for a face whose parser cannot embed', async () => {
    registerFontOutlines('emb-bare', {}, interBytes(), {
      parser: async (bytes) => {
        const { embedding: _drop, ...rest } = await openTypeParser(bytes);
        return rest;
      },
    });
    expect(await fontEmbedding('emb-bare', 400, 'normal')).toBeNull();
  });

  it('reports a restricted face as not embeddable', async () => {
    const bytes = interBytes();
    new DataView(bytes).setUint16(tableOffset(bytes, 'OS/2') + 8, 0x0002);
    registerFontOutlines('emb-locked', {}, bytes);
    expect((await fontEmbedding('emb-locked', 400, 'normal'))!.embeddable).toBe(false);
  });

  it('cuts a collection member out of its collection', async () => {
    const collection = oneMemberCollection(interBytes());
    expect(String.fromCharCode(...new Uint8Array(collection, 0, 4))).toBe('ttcf');
    const name = sfntFromCollection(collection).names[0]!;
    registerFontOutlines('emb-ttc', {}, collection, { parser: createOpenTypeParser(name) });
    const e = (await fontEmbedding('emb-ttc', 400, 'normal'))!;
    expect(new Uint8Array(e.sfnt, 0, 4)).toEqual(new Uint8Array([0, 1, 0, 0]));
    expect(e.postScriptName).toBe(name);
  });
});
